import * as umbracoModels from './models/umbraco';
import * as parserModels from './models/parser';
import { removeInheritedGroupsAndProperties } from './umbracoHelpers';

export function mapUmbracoDocumentTypeToParser(model: umbracoModels.DocumentTypeDisplay, allContentTypes: umbracoModels.ContentTypeBasic[]) {
    const cleanedGroups = removeInheritedGroupsAndProperties(model.groups);

    const tabs = cleanedGroups
        .filter(x => x.type == 'Tab')
        .sort((a, b) => a.sortOrder - b.sortOrder);

    const groups = cleanedGroups
        .filter(x => x.type == 'Group' && !x.alias.includes('/'))
        .sort((a, b) => a.sortOrder - b.sortOrder);

    const icon = model.icon?.split(' ');

    return new parserModels.DocumentType({
        alias: model.alias,
        name: model.name ?? '',
        allowedTemplates: undefinedIfEmpty(model.allowedTemplates, x => x.alias),
        defaultTemplate: undefinedIfNotTruthy(model.defaultTemplate?.alias),
        allowAsRoot: undefinedIfNotTruthy(model.allowAsRoot),
        allowCultureVariant: undefinedIfNotTruthy(model.allowCultureVariant),
        allowedChildTypes: undefinedIfEmpty(model.allowedContentTypes ?? [], x => allContentTypes.find(c => c.id == x)?.alias ?? ''),
        allowSegmentVariant: undefinedIfNotTruthy(model.allowSegmentVariant),
        compositions: undefinedIfEmpty(model.compositeContentTypes ?? [], x => x),
        description: undefinedIfNotTruthy(model.description),
        enableListView: undefinedIfNotTruthy(model.isContainer),
        historyCleanup: model.historyCleanup.preventCleanup || model.historyCleanup.keepAllVersionsNewerThanDays != null || model.historyCleanup.keepLatestVersionPerDayForDays != null ? {
            preventCleanup: undefinedIfNotTruthy(model.historyCleanup.preventCleanup),
            keepAllVersionsNewerThanDays: undefinedIfNotNullOrUndefined(model.historyCleanup.keepAllVersionsNewerThanDays),
            keepLatestVersionPerDayForDays: undefinedIfNotNullOrUndefined(model.historyCleanup.keepLatestVersionPerDayForDays)
        } : undefined,
        icon: icon ? (
            icon[1] ? {
                name: icon[0],
                color: icon[1]
            } : icon[0]
        ) : undefined,
        isElement: undefinedIfNotTruthy(model.isElement),
        groups: undefinedIfEmpty(groups, x => mapUmbracoPropertyGroupToParserGroup(x)),
        tabs: undefinedIfEmpty(tabs, x => mapUmbracoPropertyGroupToParserTab(x, cleanedGroups))
    });
}

export function mapUmbracoPropertyGroupToParserTab(
    model: umbracoModels.PropertyGroupDisplay<umbracoModels.PropertyTypeDisplay>,
    groups: umbracoModels.PropertyGroupDisplay<umbracoModels.PropertyTypeDisplay>[]
) {
    return new parserModels.Tab({
        alias: model.alias,
        name: model.name ?? '',
        sortOrder: model.sortOrder !== 0 ? model.sortOrder : undefined,
        groups: groups
            .filter(x => x.type === 'Group' && x.alias.startsWith(`${model.alias}/`))
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(x => mapUmbracoPropertyGroupToParserGroup(x))
    });
}

export function mapUmbracoPropertyGroupToParserGroup(
    model: umbracoModels.PropertyGroupDisplay<umbracoModels.PropertyTypeDisplay>
) {
    return new parserModels.Group({
        alias: model.alias,
        name: model.name ?? '',
        sortOrder: model.sortOrder !== 0 ? model.sortOrder : undefined,
        properties: model.properties
            .sort((a, b) => (a.sortOrder ?? 0 )- (b.sortOrder ?? 0))
            .map(x => mapUmbracoPropertyTypeToParser(x))
    });
}

export function mapUmbracoPropertyTypeToParser(model: umbracoModels.PropertyTypeDisplay) {
    return new parserModels.Property({
        alias: model.alias,
        label: model.label,
        dataType: model.dataTypeName ?? '',
        allowCultureVariant: undefinedIfNotTruthy(model.allowCultureVariant),
        allowSegmentVariant: undefinedIfNotTruthy(model.allowSegmentVariant),
        description: undefinedIfNotTruthy(model.description),
        labelOnTop: undefinedIfNotTruthy(model.labelOnTop),
        sortOrder: model.sortOrder !== 0 ? model.sortOrder : undefined,
        validation: model.validation.mandatory || model.validation.pattern ? {
            mandatory: undefinedIfNotTruthy(model.validation.mandatory),
            mandatoryMessage: undefinedIfNotTruthy(model.validation.mandatoryMessage),
            pattern: undefinedIfNotTruthy(model.validation.pattern),
            patternMessage: undefinedIfNotTruthy(model.validation.patternMessage)
        } : undefined
    });
}

function undefinedIfNotTruthy<T>(val: T) {
    return val ? val : undefined;
}

function undefinedIfNotNullOrUndefined<T>(val: T) {
    return val != null && val != undefined ? val : undefined;
}

function undefinedIfEmpty<T, U>(val: T[], map: (value: T, index: number, array: T[]) => U) {
    return val.length > 0 ? val.map(map) : undefined;
}