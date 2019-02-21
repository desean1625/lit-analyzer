import {
	LitHtmlDiagnostic,
	LitHtmlDiagnosticHtmlBoolMod,
	LitHtmlDiagnosticPrimitiveNotAssignableToComplex,
	LitHtmlDiagnosticMissingImport,
	LitHtmlDiagnosticUnknownAttribute,
	LitHtmlDiagnosticUnknownTag
} from "./lit-diagnostic";
import { LitCodeFixAction } from "./lit-code-fix-action";

export enum CodeFixKind {
	RENAME = "RENAME",
	CHANGE_LIT_MODIFIER = "CHANGE_LIT_MODIFIER",
	IMPORT_COMPONENT = "IMPORT_COMPONENT"
}

export interface CodeFixBase {
	message: string;
	htmlReport: LitHtmlDiagnostic;
	actions: LitCodeFixAction[];
}

export interface CodeFixRename extends CodeFixBase {
	kind: CodeFixKind.RENAME;
	htmlReport: LitHtmlDiagnosticUnknownAttribute | LitHtmlDiagnosticUnknownTag;
}

export interface CodeFixChangeLitModifier extends CodeFixBase {
	kind: CodeFixKind.CHANGE_LIT_MODIFIER;
	htmlReport: LitHtmlDiagnosticHtmlBoolMod | LitHtmlDiagnosticPrimitiveNotAssignableToComplex;
}

export interface CodeFixImportComponent extends CodeFixBase {
	kind: CodeFixKind.IMPORT_COMPONENT;
	htmlReport: LitHtmlDiagnosticMissingImport;
}

export type LitCodeFix = CodeFixRename | CodeFixChangeLitModifier | CodeFixImportComponent;
