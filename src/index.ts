import MagicString from "magic-string";
import { minify } from "oxc-minify";
import type * as vite from "vite";

const USE_ROUTE_MODULE_DIRECTIVE = "use route";
const PRELIM_USE_ROUTE_MODULE_DIRECTIVE_REGEX = /(['"])use route\1/;

const SHARED_EXPORTS = ["meta", "links"];

const CLIENT_COMPONENTS = ["default", "ErrorBoundary", "Layout", "HydrateFallback"];
const CLIENT_FUNCTIONS = ["clientAction", "clientLoader"];
const CLIENT_EXPORTS = [
  ...CLIENT_COMPONENTS,
  ...CLIENT_FUNCTIONS,
  ...SHARED_EXPORTS,
  "clientMiddleware",
  "handle",
  "shouldRevalidate",
];

const SERVER_COMPONENTS = [
  "ServerComponent",
  "ServerErrorBoundary",
  "ServerLayout",
  "ServerHydrateFallback",
];
const ASYNC_SERVER_FUNCTIONS = ["action", "loader"];
const SYNC_SERVER_FUNCTIONS = ["headers"];
const SERVER_EXPORTS = [
  ...SERVER_COMPONENTS,
  ...ASYNC_SERVER_FUNCTIONS,
  ...SYNC_SERVER_FUNCTIONS,
  "middleware",
];

const ALLOWED_EXPORTS = new Set([...CLIENT_EXPORTS, ...SERVER_EXPORTS, ...SHARED_EXPORTS]);

type SharedContext = {
  error(message: string): never;
};

export default function rscRouteModules() {
  return [routeModuleDirective()];
}

export function routeModuleDirective({
  environments: { client = ["client", "ssr"], server = ["rsc"] } = {},
}: {
  environments?: {
    client?: string[];
    server?: string[];
  };
} = {}) {
  const isServerEnvironment = (envName: string) => server.includes(envName);
  const allowedEnvironments = [...client, ...server];
  const isAllowedEnvironment = (envName: string) => allowedEnvironments.includes(envName);

  return {
    name: "vite-plugin-rsc-route-modules",
    transform: {
      async handler(code, id) {
        if (!isAllowedEnvironment(this.environment.name)) return;

        if (!PRELIM_USE_ROUTE_MODULE_DIRECTIVE_REGEX.test(code)) return;

        const program = this.parse(code, { sourceType: "module" });

        const useRouteDirective = findDirective(program.body, USE_ROUTE_MODULE_DIRECTIVE);

        if (!useRouteDirective) return;

        if (findDirective(program.body, "use client")) {
          this.error('"use client" directive is not allowed in route modules');
        }

        if (findDirective(program.body, "use server")) {
          this.error('"use server" directive is not allowed in route modules');
        }

        const [filename, ...rest] = id.split("?");
        const searchParams = rest.length > 0 ? new URLSearchParams(rest.join("?")) : null;

        let magicString = new MagicString(code, { filename });

        magicString.remove(useRouteDirective.start, useRouteDirective.end);

        const isClientRouteModule = searchParams?.has("client-route-module");
        const clientRouteModuleType = searchParams?.get("client-route-module");
        const isServerRouteModule = searchParams?.has("server-route-module");
        const serverRouteModuleType = searchParams?.get("server-route-module");
        const isSharedRouteModule = searchParams?.has("shared-route-module");

        if (
          [isClientRouteModule, isServerRouteModule, isSharedRouteModule].filter(Boolean).length > 1
        ) {
          this.error(
            "Module cannot be both a client, server, or shared route module, this is most likely an error, please file a reproduction.",
          );
        }

        const sharedContext: SharedContext = {
          error: this.error.bind(this),
        };

        let nakedImports: string[] = [];

        if (clientRouteModuleType) {
          nakedImports = createClientRouteModuleChunk.call(
            sharedContext,
            program,
            magicString,
            clientRouteModuleType,
          );
        } else if (isClientRouteModule) {
          magicString = new MagicString("", { filename });
          createClientRouteModule.call(sharedContext, id, program, magicString);
        } else if (serverRouteModuleType) {
          nakedImports = createServerRouteModuleChunk.call(sharedContext, program, magicString);
        } else if (isServerRouteModule) {
          magicString = new MagicString("", { filename });
          nakedImports = createServerRouteModule.call(sharedContext, id, program, magicString);
        } else if (isSharedRouteModule) {
          nakedImports = createSharedRouteModuleChunk.call(sharedContext, program, magicString);
        } else {
          if (!isServerEnvironment(this.environment.name)) {
            this.error('"use route" directive is only allowed in server environments');
          }
          magicString = new MagicString("", { filename });
          createSplitRouteModule.call(sharedContext, id, program, magicString);
        }

        const deadCodeEliminationResult = await minify(filename, magicString.toString(), {
          compress: {
            dropDebugger: false,
            joinVars: false,
            keepNames: {
              class: true,
              function: true,
            },
          },
          codegen: false,
          mangle: false,
          module: true,
        });

        if (deadCodeEliminationResult.errors.length > 0) {
          this.error(
            `Failed to minify code for dead code elimination: ${deadCodeEliminationResult.errors
              .map((e) => e.message)
              .join(", ")}`,
          );
        }

        const finalProgram = this.parse(deadCodeEliminationResult.code, { sourceType: "module" });
        const finalMagicString = new MagicString(deadCodeEliminationResult.code, { filename });
        removeNakedImports(finalProgram, finalMagicString);

        for (const keepImport of nakedImports) {
          finalMagicString.prepend(`import "${keepImport}";\n`);
        }

        return {
          code: finalMagicString.toString(),
          map: finalMagicString.generateMap(),
        };
      },
    },
  } satisfies vite.Plugin;
}

function createClientRouteModuleChunk(
  this: SharedContext,
  program: vite.ESTree.Program,
  magicString: MagicString,
  clientRouteModuleType: string,
) {
  const nakedImports = findNakedImports.call(this, program);
  const foundExports = findExportedNames.call(this, program);

  const exportsToRemove = new Set(foundExports);
  exportsToRemove.delete(clientRouteModuleType);

  removeExports.call(this, program, magicString, [...exportsToRemove]);

  return nakedImports;
}

function createClientRouteModule(
  this: SharedContext,
  id: string,
  program: vite.ESTree.Program,
  magicString: MagicString,
) {
  const exportedNames = findExportedNames.call(this, program);

  let needsReactImport = false;

  for (const name of exportedNames) {
    if (CLIENT_FUNCTIONS.includes(name)) {
      const clientId = createIdFrom(id, "client-route-module", name);
      magicString.append(
        name === "default"
          ? "export default "
          : `export const ${name} = (...args) => import(${JSON.stringify(clientId)}).then((mod) => mod.${name}(...args));\n`,
      );
    } else if (SHARED_EXPORTS.includes(name)) {
      const sharedId = createIdFrom(id, "shared-route-module");
      magicString.append(`export { ${name} } from ${JSON.stringify(sharedId)};\n`);
    } else if (CLIENT_EXPORTS.includes(name)) {
      const clientId = createIdFrom(id, "client-route-module", name);
      magicString.append(`export { ${name} } from ${JSON.stringify(clientId)};\n`);
    }
  }

  if (needsReactImport) {
    magicString.prepend(`import * as __rr_React from "react";\n`);
  }

  magicString.prepend('"use client";\n');
}

function createServerRouteModuleChunk(
  this: SharedContext,
  program: vite.ESTree.Program,
  magicString: MagicString,
) {
  const nakedImports = findNakedImports.call(this, program);

  const exportsToRemove = new Set(ALLOWED_EXPORTS);
  for (const serverExport of SERVER_EXPORTS) {
    exportsToRemove.delete(serverExport);
  }

  removeExports.call(this, program, magicString, [...exportsToRemove]);

  return nakedImports;
}

function createServerRouteModule(
  this: SharedContext,
  id: string,
  program: vite.ESTree.Program,
  magicString: MagicString,
) {
  const exportedNames = findExportedNames.call(this, program);
  const nakedImports = findNakedImports(program);

  let needsReactImport = false;

  for (const name of exportedNames) {
    if (SHARED_EXPORTS.includes(name)) {
      const serverId = createIdFrom(id, "shared-route-module");
      magicString.append(`export { ${name} } from ${JSON.stringify(serverId)};`);
    } else if (ASYNC_SERVER_FUNCTIONS.includes(name) || SYNC_SERVER_FUNCTIONS.includes(name)) {
      const serverId = createIdFrom(id, "server-route-module", "implementation");
      magicString.append(`export { ${name} } from ${JSON.stringify(serverId)};\n`);
    } else if (SERVER_COMPONENTS.includes(name)) {
      needsReactImport = true;
      const serverId = createIdFrom(id, "server-route-module", "implementation");
      magicString.append(
        [
          `import { ${name} as ${name}WithoutCSS } from ${JSON.stringify(serverId)};\n`,
          `export function ${name}(props) {`,
          `    return React.createElement(React.Fragment, null, import.meta.viteRsc.loadCss(), React.createElement(${name}WithoutCSS, props));`,
          "}",
        ].join("\n"),
      );
    }
  }

  if (needsReactImport) {
    magicString.prepend(`import * as React from "react";\n`);
  }

  return nakedImports;
}

function createSharedRouteModuleChunk(
  this: SharedContext,
  program: vite.ESTree.Program,
  magicString: MagicString,
) {
  const nakedImports = findNakedImports.call(this, program);

  const exportsToRemove = new Set(ALLOWED_EXPORTS);
  for (const sharedExport of SHARED_EXPORTS) {
    exportsToRemove.delete(sharedExport);
  }

  removeExports.call(this, program, magicString, [...exportsToRemove]);

  return nakedImports;
}

function createSplitRouteModule(
  this: SharedContext,
  id: string,
  program: vite.ESTree.Program,
  magicString: MagicString,
) {
  const exportedNames = findExportedNames.call(this, program);

  for (const name of exportedNames) {
    if (!ALLOWED_EXPORTS.has(name)) {
      this.error(
        `Exported name "${name}" is not allowed in route modules. Allowed exports are: ${[
          ...ALLOWED_EXPORTS,
        ].join(", ")}`,
      );
    }

    if (SHARED_EXPORTS.includes(name)) {
      magicString.append(
        `export { ${name} } from ${JSON.stringify(createIdFrom(id, "shared-route-module"))};`,
      );
    } else if (CLIENT_EXPORTS.includes(name)) {
      magicString.append(
        `export { ${name} } from ${JSON.stringify(createIdFrom(id, "client-route-module"))};`,
      );
    } else if (SERVER_EXPORTS.includes(name)) {
      magicString.append(
        `export { ${name} } from ${JSON.stringify(createIdFrom(id, "server-route-module"))};`,
      );
    }
  }
}

function findDirective(
  nodes: (vite.ESTree.Directive | vite.ESTree.Statement)[],
  directive: string,
) {
  return nodes.find((node) => {
    return (
      node.type === "ExpressionStatement" &&
      node.expression.type === "Literal" &&
      node.directive === directive
    );
  });
}

function removeExports(
  this: SharedContext,
  program: vite.ESTree.Program,
  magicString: MagicString,
  exportsToRemove: string[],
) {
  visitExports.call(
    this,
    program,
    (name, node) => {
      if (exportsToRemove.includes(name)) {
        removeNamedExport.call(this, name, node, magicString);
      }
    },
    magicString,
  );
}

function removeNamedExport(
  this: SharedContext,
  name: string,
  node: vite.ESTree.ExportNamedDeclaration | vite.ESTree.ExportDefaultDeclaration,
  magicString: MagicString,
) {
  if (node.type === "ExportNamedDeclaration") {
    if (node.declaration) {
      if (node.declaration.type === "FunctionDeclaration" && node.declaration.id) {
        if (node.declaration.id.name === name) {
          magicString.remove(node.start, node.end);
          node.declaration = null;
        }
      } else if (node.declaration.type === "VariableDeclaration") {
        const declsToKeep = node.declaration.declarations.filter((decl) => {
          if (decl.id.type === "Identifier" && decl.id.name === name) {
            return false;
          }
          return true;
        });

        if (declsToKeep.length === 0) {
          magicString.remove(node.start, node.end);
          node.declaration = null;
        } else if (declsToKeep.length !== node.declaration.declarations.length) {
          const firstDeclToRemove = node.declaration.declarations.find(
            (decl) => decl.id.type === "Identifier" && decl.id.name === name,
          );
          if (firstDeclToRemove) {
            magicString.remove(firstDeclToRemove.start, firstDeclToRemove.end);
            node.declaration.declarations = declsToKeep;
          }
        }
      } else if (node.declaration.type === "ClassDeclaration" && node.declaration.id) {
        if (node.declaration.id.name === name) {
          magicString.remove(node.start, node.end);
          node.declaration = null;
        }
      }
    }

    if (node.specifiers) {
      const specifiersToKeep = node.specifiers.filter((specifier) => {
        if (specifier.exported.type === "Identifier" && specifier.exported.name === name) {
          return false;
        }
        return true;
      });

      if (specifiersToKeep.length === 0 && !node.declaration) {
        magicString.remove(node.start, node.end);
        node.specifiers = [];
      } else if (specifiersToKeep.length !== node.specifiers.length) {
        const firstSpecifierToRemove = node.specifiers.find(
          (specifier) =>
            specifier.exported.type === "Identifier" && specifier.exported.name === name,
        );
        if (firstSpecifierToRemove) {
          magicString.remove(firstSpecifierToRemove.start, firstSpecifierToRemove.end);
          node.specifiers = specifiersToKeep;
        }
      }
    }

    if (node.specifiers.length === 0 && !node.declaration) {
      magicString.remove(node.start, node.end);
    }
  } else if (node.type === "ExportDefaultDeclaration") {
    if (name === "default") {
      magicString.remove(node.start, node.end);
    } else {
      this.error(`Cannot remove named export "${name}" from default export`);
    }
  }
}

function visitImports(
  program: vite.ESTree.Program,
  visitor: (node: vite.ESTree.ImportDeclaration) => void,
) {
  for (const node of program.body) {
    if (node.type === "ImportDeclaration") {
      visitor(node);
    }
  }
}

function findNakedImports(program: vite.ESTree.Program): string[] {
  const nakedImports: string[] = [];
  visitImports(program, (node) => {
    if (node.specifiers.length === 0) {
      nakedImports.push(node.source.value);
    }
  });
  return nakedImports;
}

function removeNakedImports(program: vite.ESTree.Program, magicString: MagicString) {
  visitImports(program, (node) => {
    if (node.type === "ImportDeclaration" && node.specifiers.length === 0) {
      magicString.remove(node.start, node.end);
    }
  });
}

function findExportedNames(this: SharedContext, program: vite.ESTree.Program) {
  const exportedNames = new Set<string>();
  visitExports.call(this, program, (name) => {
    exportedNames.add(name);
  });
  return exportedNames;
}

function visitExports(
  this: SharedContext,
  program: vite.ESTree.Program,
  visitor: (
    name: string,
    node: vite.ESTree.ExportNamedDeclaration | vite.ESTree.ExportDefaultDeclaration,
  ) => void,
  magicString?: MagicString,
) {
  for (const node of program.body) {
    if (node.type === "ExportNamedDeclaration") {
      if (node.declaration) {
        if (node.declaration.type === "FunctionDeclaration" && node.declaration.id) {
          visitor(node.declaration.id.name, node);
        } else if (node.declaration.type === "VariableDeclaration") {
          for (const decl of node.declaration.declarations) {
            if (decl.id.type === "Identifier") {
              visitor(decl.id.name, node);
            }
          }
        } else if (node.declaration.type === "ClassDeclaration" && node.declaration.id) {
          visitor(node.declaration.id.name, node);
        }
      }

      if (node.specifiers) {
        for (const specifier of node.specifiers) {
          if (specifier.exported.type === "Identifier") {
            visitor(specifier.exported.name, node);
          }
        }
      }

      if (node.specifiers.length === 0 && !node.declaration) {
        magicString?.remove(node.start, node.end);
      }
    } else if (node.type === "ExportDefaultDeclaration") {
      visitor("default", node);
    } else if (node.type === "ExportAllDeclaration") {
      this.error("ExportAllDeclaration (export * from '...') is not supported in route modules");
    }
  }
}

function createIdFrom(id: string, type: "server-route-module" | "shared-route-module"): string;
function createIdFrom(id: string, type: "client-route-module", value?: string): string;
function createIdFrom(id: string, type: "server-route-module", value?: "implementation"): string;
function createIdFrom(
  id: string,
  type: "client-route-module" | "server-route-module" | "shared-route-module",
  value?: string,
): string {
  let [base, ...rest] = id.split("?");
  const searchParams = new URLSearchParams(rest.join("?"));
  searchParams.delete("client-route-module");
  searchParams.delete("server-route-module");
  searchParams.delete("shared-route-module");
  searchParams.set(type, value || "");
  return `${base}?${searchParams.toString()}`;
}
