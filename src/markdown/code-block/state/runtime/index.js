// @ts-check

export { codeBlockRuntimePlugin } from './plugin-runtime-service';

/**
 * @typedef {{
 *  codeBlockStates: (ScriptRuntimeState | undefined)[],
 *  globalVariables: string[]
 * }} DocumentRuntimeState
 */

/**
 * @typedef {{
 *  phase: 'unknown',
 *  stale?: ScriptRuntimeStateSucceeded | ScriptRuntimeStateFailed
 * }} ScriptRuntimeStateUnknown
 */

/**
 * @typedef {{
 *  phase: 'parsed',
 *  variables?: string[],
 *  syntaxErrors?: boolean,
 *  stale?: ScriptRuntimeStateSucceeded | ScriptRuntimeStateFailed
 * }} ScriptRuntimeStateParsed
 */

/**
 * @typedef {Omit<ScriptRuntimeStateParsed, 'phase'> & {
 *  phase: 'executing',
 *  started: number
 *  logs: { urgency?: string, output: any[] }[]
 * }} ScriptRuntimeStateExecuting
 */

/**
 * @typedef {Omit<ScriptRuntimeStateExecuting, 'phase' | 'stale'> & {
 *  phase: 'succeeded',
 *  completed: number,
 *  result: any
 * }} ScriptRuntimeStateSucceeded
 */

/**
 * @typedef {Omit<ScriptRuntimeStateExecuting, 'phase' | 'stale'> & {
 *  phase: 'failed',
 *  completed: number,
 *  error: any
 * }} ScriptRuntimeStateFailed
 */

/**
 * @typedef {ScriptRuntimeStateUnknown |
 *  ScriptRuntimeStateParsed |
 *  ScriptRuntimeStateExecuting |
 *  ScriptRuntimeStateSucceeded |
 *  ScriptRuntimeStateFailed
 * } ScriptRuntimeState
 */

/**
 * @typedef {{
 *  parse(args: {
 *    codeBlockRegions: { code: string, language: string | null | undefined, langSpecified?: string | null | undefined }[],
 *    editorState: import('@milkdown/prose/state').EditorState
 * }): ({ variables?: string[], unchanged?: boolean, syntaxErrors?: boolean } | undefined)[];
 *  runCodeBlock(codeBlockIndex: number, globals: any[], logger: (urgency: string, args: any[]) => void): Promise<any> | any;
 *  hydrateReference?(reference: string): Promise<any>;
 *  onRequestRerun?: () => void;
 * }} ExecutionRuntime
 */

/**
 * @typedef {{
 *  urgency: 'error' | 'warning',
 *  outputs: any[]
 * }} LogOutput
 */