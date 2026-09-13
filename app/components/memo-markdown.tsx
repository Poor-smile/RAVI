"use client";

import { createContext, memo, useContext } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkHighlight from "../markdown/remark-highlight";
import remarkUnderline from "../markdown/remark-underline";

const plugins = [remarkGfm, remarkHighlight, remarkUnderline];
const MarkdownSourceStart = createContext(0);
export const useMarkdownSourceStart = () => useContext(MarkdownSourceStart);

// Appending another chunk must not parse the entire rendered prefix again.
export const MemoMarkdown = memo(function MemoMarkdown({ content, components, urlTransform, sourceStart = 0 }: {
  content: string;
  sourceStart?: number;
  components: Components;
  urlTransform: NonNullable<React.ComponentProps<typeof ReactMarkdown>["urlTransform"]>;
}) {
  return <MarkdownSourceStart.Provider value={sourceStart}><ReactMarkdown remarkPlugins={plugins} components={components} urlTransform={urlTransform}>{content}</ReactMarkdown></MarkdownSourceStart.Provider>;
});
