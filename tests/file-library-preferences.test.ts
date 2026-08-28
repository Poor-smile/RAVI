import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_FILE_LIBRARY_PREFERENCES,
  parseFileLibraryPreferences,
} from "../app/settings/file-library-preferences";

test("file and library preferences use product-safe local defaults", () => {
  assert.deepEqual(
    parseFileLibraryPreferences(null),
    DEFAULT_FILE_LIBRARY_PREFERENCES,
  );
  assert.deepEqual(
    parseFileLibraryPreferences("not-json"),
    DEFAULT_FILE_LIBRARY_PREFERENCES,
  );
});

test("file and library preferences preserve valid values and reject unknown ones", () => {
  assert.deepEqual(
    parseFileLibraryPreferences(
      JSON.stringify({
        defaultOpenMode: "writing",
        fileVisibility: "markdown",
        autoRefresh: false,
        activeWorkspaceRootId: "d:/notes/raavi",
        restoreDocumentTabs: false,
      }),
    ),
    {
      defaultOpenMode: "writing",
      fileVisibility: "markdown",
      autoRefresh: false,
      activeWorkspaceRootId: "d:/notes/raavi",
      restoreDocumentTabs: false,
    },
  );
  assert.deepEqual(
    parseFileLibraryPreferences(
      JSON.stringify({
        defaultOpenMode: "preview",
        fileVisibility: "pdf",
        autoRefresh: "yes",
        activeWorkspaceRootId: 42,
        restoreDocumentTabs: "yes",
      }),
    ),
    DEFAULT_FILE_LIBRARY_PREFERENCES,
  );
});
