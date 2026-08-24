import assert from "node:assert/strict";
import test from "node:test";
import { closestSemanticOffset } from "../app/context/semantic-anchor";

test("semantic anchor resolves an exact Markdown source offset", () => {
  assert.equal(closestSemanticOffset([0, 24, 80, 144], 80), 80);
});

test("semantic anchor resolves the nearest structural block", () => {
  assert.equal(closestSemanticOffset([0, 24, 80, 144], 70), 80);
  assert.equal(closestSemanticOffset([0, 24, 80, 144], 30), 24);
});

test("semantic anchor prefers the preceding block when distances tie", () => {
  assert.equal(closestSemanticOffset([0, 40, 80], 60), 40);
});

test("semantic anchor safely handles an empty document index", () => {
  assert.equal(closestSemanticOffset([], 120), null);
});
