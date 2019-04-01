import * as vscode from "vscode-css-languageservice";
import { IAtDirectiveData, ICSSDataProvider, IPropertyData, IPseudoClassData, IPseudoElementData } from "vscode-css-languageservice";
import { CssDocument } from "../../parsing/text-document/css-document/css-document";
import { TsLitPluginStore } from "../../state/store";
import { iterableFilter, iterableMap } from "../../util/iterable-util";
import { lazy } from "../../util/util";
import { DiagnosticsContext } from "../diagnostics-context";
import { LitCompletion, LitCompletionKind } from "../types/lit-completion";
import { LitCssDiagnostic } from "../types/lit-diagnostic";
import { LitQuickInfo } from "../types/lit-quick-info";

function makeVscTextDocument(cssDocument: CssDocument): vscode.TextDocument {
	return vscode.TextDocument.create("untitled://embedded.css", "css", 1, cssDocument.virtualDocument.text);
}

export class VscodeCssService {
	private dataProvider = new LitVscodeCSSDataProvider();

	private get cssService() {
		return vscode.getCSSLanguageService({ customDataProviders: [this.dataProvider.provider] });
	}

	private get scssService() {
		return vscode.getSCSSLanguageService({ customDataProviders: [this.dataProvider.provider] });
	}

	getDiagnostics(document: CssDocument, context: DiagnosticsContext): LitCssDiagnostic[] {
		this.dataProvider.update(context.store);

		const vscTextDocument = makeVscTextDocument(document);
		const vscStylesheet = this.makeVscStylesheet(vscTextDocument);
		const diagnostics = this.scssService.doValidation(vscTextDocument, vscStylesheet);

		return diagnostics
			.filter(diagnostic => diagnostic.range.start.line !== 0 && diagnostic.range.start.line < vscTextDocument.lineCount - 1)
			.map(
				diagnostic =>
					({
						severity: diagnostic.severity === vscode.DiagnosticSeverity.Error ? "error" : "warning",
						location: {
							start: vscTextDocument.offsetAt(diagnostic.range.start),
							end: vscTextDocument.offsetAt(diagnostic.range.end)
						},
						message: diagnostic.message
					} as LitCssDiagnostic)
			);
	}

	getQuickInfo(document: CssDocument, offset: number, context: DiagnosticsContext): LitQuickInfo | undefined {
		this.dataProvider.update(context.store);

		const vscTextDocument = makeVscTextDocument(document);
		const vscStylesheet = this.makeVscStylesheet(vscTextDocument);
		const vscPosition = vscTextDocument.positionAt(offset);
		const hover = this.scssService.doHover(vscTextDocument, vscPosition, vscStylesheet);
		if (hover == null || hover.range == null) return;

		const contents = Array.isArray(hover.contents) ? hover.contents : [hover.contents];
		let primaryInfo: string | undefined = undefined;
		let secondaryInfo: string | undefined = undefined;

		for (const content of contents) {
			const text = typeof content === "string" ? content : content.value;

			if (typeof content === "object" && "language" in content) {
				if (content.language === "html") {
					primaryInfo = `${primaryInfo == null ? "" : "\n\n"}${text}`;
				}
			} else {
				secondaryInfo = text;
			}
		}

		return {
			primaryInfo: primaryInfo || "",
			secondaryInfo,
			range: {
				start: vscTextDocument.offsetAt(hover.range.start),
				end: vscTextDocument.offsetAt(hover.range.end)
			}
		};
	}

	getCompletions(document: CssDocument, offset: number, context: DiagnosticsContext): LitCompletion[] {
		this.dataProvider.update(context.store);

		const vscTextDocument = makeVscTextDocument(document);
		const vscStylesheet = this.makeVscStylesheet(vscTextDocument);
		const vscPosition = vscTextDocument.positionAt(offset);
		const items = this.cssService.doComplete(vscTextDocument, vscPosition, vscStylesheet);

		return items.items.map(
			i =>
				({
					kind: i.kind == null ? "unknown" : translateCompletionItemKind(i.kind),
					insert: i.label,
					name: i.label,
					kindModifiers: i.kind === vscode.CompletionItemKind.Color ? "color" : undefined,
					importance: i.label.startsWith("@") || i.label.startsWith("-") ? "low" : i.label.startsWith(":") ? "medium" : "high",
					documentation: lazy(() => (typeof i.documentation === "string" || i.documentation == null ? i.documentation : i.documentation.value))
				} as LitCompletion)
		);
	}

	private makeVscStylesheet(vscTextDocument: vscode.TextDocument) {
		return this.scssService.parseStylesheet(vscTextDocument);
	}
}

function translateCompletionItemKind(kind: vscode.CompletionItemKind): LitCompletionKind {
	switch (kind) {
		case vscode.CompletionItemKind.Method:
			return "memberFunctionElement";
		case vscode.CompletionItemKind.Function:
			return "functionElement";
		case vscode.CompletionItemKind.Constructor:
			return "constructorImplementationElement";
		case vscode.CompletionItemKind.Field:
		case vscode.CompletionItemKind.Variable:
			return "variableElement";
		case vscode.CompletionItemKind.Class:
			return "classElement";
		case vscode.CompletionItemKind.Interface:
			return "interfaceElement";
		case vscode.CompletionItemKind.Module:
			return "moduleElement";
		case vscode.CompletionItemKind.Property:
			return "memberVariableElement";
		case vscode.CompletionItemKind.Unit:
		case vscode.CompletionItemKind.Value:
			return "constElement";
		case vscode.CompletionItemKind.Enum:
			return "enumElement";
		case vscode.CompletionItemKind.Keyword:
			return "keyword";
		case vscode.CompletionItemKind.Color:
			return "constElement";
		case vscode.CompletionItemKind.Reference:
			return "alias";
		case vscode.CompletionItemKind.File:
			return "moduleElement";
		case vscode.CompletionItemKind.Snippet:
		case vscode.CompletionItemKind.Text:
		default:
			return "unknown";
	}
}

class LitVscodeCSSDataProvider {
	private pseudoElementData: IPseudoElementData[] = [];

	private customDataProvider: ICSSDataProvider = (() => {
		const provider = this;
		return {
			providePseudoElements(): IPseudoElementData[] {
				return provider.pseudoElementData;
			},
			provideAtDirectives(): IAtDirectiveData[] {
				return [];
			},
			providePseudoClasses(): IPseudoClassData[] {
				return [];
			},
			provideProperties(): IPropertyData[] {
				return [];
			}
		};
	})();

	get provider(): ICSSDataProvider {
		return this.customDataProvider;
	}

	update(store: TsLitPluginStore) {
		this.pseudoElementData = Array.from(
			iterableMap(
				iterableFilter(store.getGlobalTags(), tag => !tag.builtIn),
				tag =>
					({
						browsers: [],
						description: tag.description,
						name: tag.tagName,
						status: "standard"
					} as IPseudoElementData)
			)
		);
	}
}
