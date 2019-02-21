import { SimpleTypeKind } from "ts-simple-type";
import { HTML5_EVENTS, HTML5_GLOBAL_ATTRIBUTES, HTML5_TAGS, HTML5_VALUE_MAP } from "vscode-html-languageservice/lib/umd/languageFacts/data/html5";
import { html5TagAttrType } from "./extra-html-data";
import { HtmlTag, HtmlTagAttr } from "./parsing/parse-html-data/html-tag";
import { HtmlDataResult, parseHtmlData } from "./parsing/parse-html-data/parse-html-data";
import { Config } from "./state/config";

export function getHtmlData(config: Config): HtmlDataResult {
	const result = parseHtmlData({
		version: 1,
		tags: HTML5_TAGS,
		globalAttributes: [...HTML5_GLOBAL_ATTRIBUTES, ...HTML5_EVENTS],
		valueSets: HTML5_VALUE_MAP
	});

	result.tags.push({
		attributes: [],
		name: "svg",
		hasDeclaration: false,
		description: ""
	});

	result.tags.push(
		...config.globalHtmlTags.map(
			tagName =>
				({
					name: tagName,
					attributes: []
				} as HtmlTag)
		)
	);

	result.globalAttrs.push(
		...config.globalHtmlAttributes.map(
			attrName =>
				({
					name: attrName,
					type: { kind: SimpleTypeKind.ANY }
				} as HtmlTagAttr)
		)
	);

	return {
		...result,
		tags: result.tags.map(tag => ({
			...tag,
			attributes: tag.attributes.map(
				attr =>
					({
						...attr,
						type: attr.type.kind === SimpleTypeKind.ANY ? html5TagAttrType(attr.name) : attr.type
					} as HtmlTagAttr)
			)
		})),
		globalAttrs: result.globalAttrs.map(
			attr =>
				({
					...attr,
					type: attr.type.kind === SimpleTypeKind.ANY ? html5TagAttrType(attr.name) : attr.type
				} as HtmlTagAttr)
		)
	};
}
