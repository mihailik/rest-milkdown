// @ts-check

import { Plugin, PluginKey } from '@milkdown/prose/state';

import { addCompletionProviderToEditorState } from '../state/plugin-completion-service';
import { codeBlockVirtualFileName, getTypescriptLanguageServiceFromEditorState, resolveDocumentPositionToTypescriptCodeBlock } from './plugin-lang';

const key = new PluginKey('TYPESCRIPT_COMPLETIONS');
export const typescriptCompletionsPlugin = new Plugin({
  key,
  state: {
    init: (config, editorState) => {
      addCompletionProviderToEditorState(
        editorState,
        ({ editorState, codeBlockIndex, codeBlockRegion, documentPos, codeOffset }) => {
          const tsBlock = resolveDocumentPositionToTypescriptCodeBlock(editorState, documentPos);
          if (!tsBlock?.lang || !tsBlock?.fileName) return;

          const completions = tsBlock.lang.languageService.getCompletionsAtPosition(
            tsBlock.fileName,
            codeOffset,
            {
              useLabelDetailsInCompletionEntries: true,
              includeCompletionsWithInsertText: true,
              includeCompletionsWithSnippetText: true,
              includeCompletionsForImportStatements: true,
              includeCompletionsForModuleExports: true,
              includePackageJsonAutoImports: 'on',
              interactiveInlayHints: true,
              displayPartsForJSDoc: true
            }, // TODO: tune completion options
            undefined); // TODO: infer and tune formatting options

          if (!completions) return;

          if (!completions.entries.length) return;

          const targetStart = completions.optionalReplacementSpan ?
            completions.optionalReplacementSpan.start :
            codeOffset;
          const targetEnd = completions.optionalReplacementSpan ?
            completions.optionalReplacementSpan.start + completions.optionalReplacementSpan.length :
            codeOffset;

          const entryElements = [];
          const withOverlaps = [];
          for (const entry of completions.entries) {
            const overlapText = codeBlockRegion.code.slice(
              entry.replacementSpan ? entry.replacementSpan.start : targetStart,
              entry.replacementSpan ? entry.replacementSpan.start + Math.max(entry.replacementSpan.length, 1) : targetEnd);

            const matchText = entry.name;
            if (!matchText) continue;

            const overlapLowerCase = overlapText.toLowerCase();
            const matchingOverlap =
              !overlapText ? true :
              overlapText === overlapLowerCase ? matchText.toLowerCase().startsWith(overlapText) :
              matchText.startsWith(overlapText);
            if (!matchingOverlap) continue;

            const entryElem = document.createElement('div');
            entryElem.className = 'completion-entry completion-entry-' + entry.kind;

            const coreNameSpan = document.createElement('span');
            coreNameSpan.className = 'completion-entry-core-name';
            entryElem.appendChild(coreNameSpan);

            const nameSpan = document.createElement('span');
            nameSpan.className = 'completion-entry-name';
            if (overlapText.length) {
              const matchingSpan = document.createElement('span');
              matchingSpan.className = 'completion-entry-name-matching';
              matchingSpan.textContent = entry.name.slice(0, overlapText.length);
              nameSpan.appendChild(matchingSpan);
              const restSpan = document.createTextNode(entry.name.slice(overlapText.length));
              nameSpan.appendChild(restSpan);
            } else {
              nameSpan.textContent = entry.name;
            }
            coreNameSpan.appendChild(nameSpan);

            if (entry.labelDetails?.detail) {
              const detailSpan = document.createElement('span');
              detailSpan.className = 'completion-entry-detail';
              detailSpan.textContent = entry.labelDetails.detail;
              entryElem.appendChild(detailSpan);
            }

            if (entry.labelDetails?.description) {
              const detailSpan = document.createElement('span');
              detailSpan.className = 'completion-entry-detail';
              detailSpan.textContent = entry.labelDetails.description;
              entryElem.appendChild(detailSpan);
            }

            const moreDetails = tsBlock.lang.languageService.getCompletionEntryDetails(
              tsBlock.fileName,
              codeOffset,
              entry.name,
              undefined,
              entry.source,
              {
                displayPartsForJSDoc: true
              },
              entry.data
            );

            if (moreDetails) {

              if (moreDetails.displayParts?.length) {
                const sideDescriptionEl = document.createElement('span');
                sideDescriptionEl.className = 'completion-entry-side-description';
                entryElem.appendChild(sideDescriptionEl);

                for (const part of moreDetails.displayParts) {
                  const partEl = document.createElement('span');
                  partEl.className = 'hi-' + part.kind;
                  partEl.textContent = part.text;
                  sideDescriptionEl.appendChild(partEl);
                }
              }
            }

            const co = {
              element: entryElem,
              apply: entry.insertText || entry.name,
              recommended: entry.isRecommended
            };
            entryElements.push(co);
            if (overlapText.length >= 2) withOverlaps.push(co);

            if (entryElements.length > 30) break;
          }

          if (!entryElements.length) return;

          if (!entryElements.some(e => e.recommended)) {
            if (withOverlaps.length) withOverlaps[0].recommended = true;
          }

          return {
            targetStart: completions.optionalReplacementSpan ?
              completions.optionalReplacementSpan.start :
              codeOffset,
            targetEnd: completions.optionalReplacementSpan ?
              completions.optionalReplacementSpan.start + completions.optionalReplacementSpan.length :
              codeOffset,
            completions: entryElements
          };
        })
    },
    apply: () => { }
  }
});