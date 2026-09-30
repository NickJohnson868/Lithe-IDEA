import { describe, expect, test } from "bun:test";
import type { FileEntry } from "@/features/file-system/types/app.types";
import type { MavenProject } from "@/features/maven/types/maven.types";
import {
  buildMavenDirectorySemantics,
  mavenProjectContextForTree,
} from "./maven-file-tree-semantics";

function project(relativePath = "."): MavenProject {
  return {
    relativePath,
    artifactId: "project",
    packaging: "pom",
    sourceRoots: [],
    profiles: [],
    hasWrapper: false,
    modules: [
      {
        relativePath: "service",
        artifactId: "service",
        packaging: "pom",
        sourceRoots: [],
        modules: [
          {
            relativePath: "service/api",
            artifactId: "api",
            packaging: "jar",
            sourceRoots: [],
            modules: [],
          },
        ],
      },
    ],
  };
}

function directory(name: string, path: string, children: FileEntry[] = []): FileEntry {
  return { name, path, isDir: true, children };
}

function file(name: string, path: string): FileEntry {
  return { name, path, isDir: false };
}

function createMavenTree(root = "D:\\project"): FileEntry[] {
  return [
    directory("project", root, [
      directory("src", `${root}\\src`, [
        directory("main", `${root}\\src\\main`, [
          directory("java", `${root}\\src\\main\\java`, [
            directory("com", `${root}\\src\\main\\java\\com`, [
              directory("example", `${root}\\src\\main\\java\\com\\example`),
            ]),
          ]),
          directory("resources", `${root}\\src\\main\\resources`),
        ]),
        directory("test", `${root}\\src\\test`, [
          directory("java", `${root}\\src\\test\\java`),
          directory("resources", `${root}\\src\\test\\resources`),
        ]),
      ]),
      file("pom.xml", `${root}\\pom.xml`),
    ]),
  ];
}

describe("Maven directory icon semantics", () => {
  test("marks unopened modules from the Maven model without reading their children", () => {
    const tree = [
      directory("project", "D:/project", [
        { name: "service", path: "D:/project/service", isDir: true },
        directory("docs", "D:/project/docs"),
      ]),
    ];
    const semantics = buildMavenDirectorySemantics(tree, {
      root: "D:/project",
      project: project(),
    });
    expect(semantics.get("D:/project")).toBe("folder.module-root");
    expect(semantics.get("D:/project/service")).toBe("folder.module-root");
    expect(semantics.get("D:/project/docs")).toBeUndefined();
    expect(tree[0]!.children![0]!.children).toBeUndefined();
  });

  test("nested module paths are reactor-relative even when the reactor is in a subdirectory", () => {
    const semantics = buildMavenDirectorySemantics(
      [directory("api", "D:/workspace/reactor/service/api")],
      { root: "D:/workspace", project: project("reactor") },
    );
    expect(semantics.get("D:/workspace/reactor/service/api")).toBe("folder.module-root");
  });

  test("does not reuse another workspace's Maven model or retain removed modules", () => {
    const model = project();
    expect(mavenProjectContextForTree("D:/other", "D:/project", model)).toBeNull();
    expect(mavenProjectContextForTree("d:/PROJECT/", "D:\\project", model)?.project).toBe(model);
    expect(
      mavenProjectContextForTree("/workspace/Project", "/workspace/project", model),
    ).toBeNull();
    const tree = [directory("service", "D:/project/service")];
    expect(
      buildMavenDirectorySemantics(tree, { root: "D:/project", project: { ...model, modules: [] } })
        .size,
    ).toBe(0);
  });
  test("marks nested Maven modules without coloring ordinary directories as modules", () => {
    const tree = createMavenTree();
    tree[0]!.children!.push(
      directory("service", "D:\\project\\service", [
        file("pom.xml", "D:\\project\\service\\pom.xml"),
      ]),
      directory("docs", "D:\\project\\docs"),
    );
    const semantics = buildMavenDirectorySemantics(tree);
    expect(semantics.get("D:\\project\\service")).toBe("folder.module-root");
    expect(semantics.get("D:\\project\\docs")).toBeUndefined();
  });
  test("recognizes standard roots and Java packages in a loaded Maven module", () => {
    const semantics = buildMavenDirectorySemantics(createMavenTree());
    expect(semantics.get("D:\\project")).toBe("folder.module-root");

    expect(semantics.get("D:\\project\\src\\main\\java")).toBe("folder.source-root");
    expect(semantics.get("D:\\project\\src\\main\\java\\com\\example")).toBe("folder.package");
    expect(semantics.get("D:\\project\\src\\test\\java")).toBe("folder.test-root");
    expect(semantics.get("D:\\project\\src\\main\\resources")).toBe("folder.resources-root");
    expect(semantics.get("D:\\project\\src\\test\\resources")).toBe("folder.test-resources-root");
  });

  test("does not label standard-looking paths without a loaded pom.xml", () => {
    const [root] = createMavenTree();
    root!.children = root!.children?.filter((entry) => entry.name !== "pom.xml");

    expect(buildMavenDirectorySemantics([root!]).size).toBe(0);
  });

  test("does not label invalid Java package directory names", () => {
    const tree = createMavenTree();
    const javaRoot = tree[0]?.children?.[0]?.children?.[0]?.children?.[0];
    javaRoot?.children?.push(
      directory("not-a-package", "D:\\project\\src\\main\\java\\not-a-package"),
    );

    expect(
      buildMavenDirectorySemantics(tree).get("D:\\project\\src\\main\\java\\not-a-package"),
    ).toBeUndefined();
  });

  test("rejects Java keywords while allowing Unicode identifiers", () => {
    const tree = createMavenTree();
    const javaRoot = tree[0]?.children?.[0]?.children?.[0]?.children?.[0];
    javaRoot?.children?.push(
      directory("class", "D:\\project\\src\\main\\java\\class"),
      directory("示例", "D:\\project\\src\\main\\java\\示例"),
    );
    const semantics = buildMavenDirectorySemantics(tree);

    expect(semantics.get("D:\\project\\src\\main\\java\\class")).toBeUndefined();
    expect(semantics.get("D:\\project\\src\\main\\java\\示例")).toBe("folder.package");
  });
});
