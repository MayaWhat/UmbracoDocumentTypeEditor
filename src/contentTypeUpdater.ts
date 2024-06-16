import * as umbracoModels from './models/umbraco';
import * as parserModels from './models/parser';
import { UmbracoApi, UmbracoApiError } from './umbracoApi';
import crypto from 'node:crypto';
import { removeInheritedGroupsAndProperties } from './umbracoHelpers';

export async function createContentType(api: UmbracoApi, name: string, parentId: number) {
    const alias = (await api.getSafeAlias(name)).alias;
    const empty = await api.getEmptyContentType(parentId.toString());

    const model: umbracoModels.DocumentTypeSave = {
        alias,
        allowAsRoot: empty.allowAsRoot,
        allowCultureVariant: empty.allowCultureVariant,
        allowedContentTypes: empty.allowedContentTypes ?? [],
        allowedTemplates: empty.allowedTemplates.map(x => x.alias),
        allowSegmentVariant: empty.allowSegmentVariant,
        compositeContentTypes: empty.compositeContentTypes ?? [],
        defaultTemplate: empty.defaultTemplate?.alias,
        description: empty.description,
        groups: empty.groups,
        historyCleanup: empty.historyCleanup,
        icon: empty.icon,
        id: empty.id,
        isContainer: empty.isContainer,
        isElement: empty.isElement,
        key: empty.key,
        name,
        parentId: empty.parentId,
        path: empty.path,
        thumbnail: empty.thumbnail,
        trashed: empty.trashed,
        variations: empty.variations
    }

    try {
        return await api.saveContentType(model);
    }
    catch (error) {
        if (error instanceof UmbracoApiError) {
            if (error.status === 400) {
                const response: umbracoModels.DocumentTypeDisplay = JSON.parse(error.body);
                throw new Error(JSON.stringify(response.ModelState));
            }
        }

        throw error;
    }
}

export async function renameContentType(api: UmbracoApi, id: string, name: string) {
    const contentType = await api.getContentTypeById(id);
    const cleanedGroups = contentType ? removeInheritedGroupsAndProperties(contentType.groups, true) : [];

    const model: umbracoModels.DocumentTypeSave = {
        alias: contentType.alias,
        allowAsRoot: contentType.allowAsRoot,
        allowCultureVariant: contentType.allowCultureVariant,
        allowedContentTypes: contentType.allowedContentTypes ?? [],
        allowedTemplates: contentType.allowedTemplates.map(x => x.alias),
        allowSegmentVariant: contentType.allowSegmentVariant,
        compositeContentTypes: contentType.compositeContentTypes ?? [],
        defaultTemplate: contentType.defaultTemplate?.alias,
        description: contentType.description,
        groups: cleanedGroups,
        historyCleanup: contentType.historyCleanup,
        icon: contentType.icon,
        id: contentType.id,
        isContainer: contentType.isContainer,
        isElement: contentType.isElement,
        key: contentType.key,
        name,
        parentId: contentType.parentId,
        path: contentType.path,
        thumbnail: contentType.thumbnail,
        trashed: contentType.trashed,
        variations: contentType.variations
    }

    try {
        return await api.saveContentType(model);
    }
    catch (error) {
        if (error instanceof UmbracoApiError) {
            if (error.status === 400) {
                const response: umbracoModels.DocumentTypeDisplay = JSON.parse(error.body);
                throw new Error(JSON.stringify(response.ModelState));
            }
        }

        throw error;
    }
}

export async function updateContentType(api: UmbracoApi, id: string, contentType: parserModels.DocumentType) {
    const allContentTypes = await api.getAllContentTypes();
    const existingContentType = await api.getContentTypeById(id);    
    const cleanedGroups = existingContentType ? removeInheritedGroupsAndProperties(existingContentType.groups, true) : [];

    const dataTypes = Object.values((await api.getGroupedDataTypes())).flatMap(x => x);

    const groups = (await Promise.all([
        ...contentType.props.tabs ?? [],
        ...contentType.props.groups ?? []
    ].map(x => mapTabOrGroup(x, dataTypes, cleanedGroups, api)))).flatMap(x => x);

    const updateModel: umbracoModels.DocumentTypeSave = {
        alias: contentType.props.alias,
        allowAsRoot: contentType.props.allowAsRoot ?? false,
        allowCultureVariant: contentType.props.allowCultureVariant ?? false,
        allowedContentTypes: contentType.props.allowedChildTypes?.map(x => allContentTypes.find(c => c.alias === x)?.id ?? 0) ?? [],
        allowedTemplates: contentType.props.allowedTemplates ?? [],
        allowSegmentVariant: contentType.props.allowSegmentVariant ?? false,
        compositeContentTypes: contentType.props.compositions ?? [],
        defaultTemplate: contentType.props.defaultTemplate,
        description: contentType.props.description,
        groups,
        historyCleanup: {
            globalEnableCleanup: existingContentType.historyCleanup.globalEnableCleanup,
            globalKeepAllVersionsNewerThanDays: existingContentType.historyCleanup.globalKeepAllVersionsNewerThanDays,
            globalKeepLatestVersionPerDayForDays: existingContentType.historyCleanup.globalKeepLatestVersionPerDayForDays,
            preventCleanup: contentType.props.historyCleanup?.preventCleanup ?? false,
            keepAllVersionsNewerThanDays: contentType.props.historyCleanup?.keepAllVersionsNewerThanDays,
            keepLatestVersionPerDayForDays: contentType.props.historyCleanup?.keepLatestVersionPerDayForDays
        },
        icon: (() => {
            if (!contentType.props.icon) {
                return undefined;
            }

            if (typeof contentType.props.icon === 'string') {
                return contentType.props.icon;
            }

            if (!contentType.props.icon.color) {
                return contentType.props.icon?.name;
            }

            return `${contentType.props.icon.name} ${contentType.props.icon.color}`
        })(),
        id: existingContentType.id,
        isContainer: contentType.props.enableListView ?? false,
        isElement: contentType.props.isElement ?? false,
        key: existingContentType.key,
        name: contentType.props.name,
        parentId: existingContentType.parentId,
        path: existingContentType.path,
        thumbnail: existingContentType.thumbnail,
        trashed: existingContentType.trashed,
        variations: existingContentType.variations
    };

    try {
        return await api.saveContentType(updateModel);
    }
    catch (error) {
        if (error instanceof UmbracoApiError) {
            if (error.status === 400) {
                const response: umbracoModels.DocumentTypeDisplay = JSON.parse(error.body);
                throw new Error(JSON.stringify(response.ModelState));
            }
        }

        throw error;
    }
}

async function mapTabOrGroup(
    x: parserModels.Tab | parserModels.Group,
    dataTypes: umbracoModels.DataTypeBasic[],
    existingGroups: umbracoModels.PropertyGroupDisplay<umbracoModels.PropertyTypeDisplay>[],
    api: UmbracoApi
): Promise<umbracoModels.PropertyGroupBasic<umbracoModels.PropertyTypeBasic>[]> {
    const existingGroup = existingGroups.find(g => g.alias === x.props.alias);

    const type = 'groups' in x.props ? 'Tab' : 'Group';
    if (existingGroup && existingGroup.type != type) {
        throw new Error(`Can't change ${existingGroup.type} ${existingGroup.alias} to ${type}`);
    }

    const alias = x.props.alias ?? (await api.getSafeAlias(x.props.name)).alias;
    const groups = (await Promise.all(
        ('groups' in x.props ? x.props.groups : []).map(g => mapTabOrGroup(g, dataTypes, existingGroups, api)))
    ).flatMap(g => g);
    const properties = await Promise.all(
        ('properties' in x.props ? x.props.properties : []).map(p => mapProperty(p, dataTypes, existingGroup, api))
    );

    return [
        {
            alias,
            id: existingGroup?.id,
            key: existingGroup?.key ?? crypto.randomUUID(),
            name: x.props.name,
            sortOrder: x.props.sortOrder ?? 0,
            type,
            properties
        },
        ...groups
    ];
}

async function mapProperty(
    x: parserModels.Property,
    dataTypes: umbracoModels.DataTypeBasic[],
    existingGroup: umbracoModels.PropertyGroupDisplay<umbracoModels.PropertyTypeDisplay> | undefined,
    api: UmbracoApi
): Promise<umbracoModels.PropertyTypeBasic> {
    const existingProperty = existingGroup?.properties.find(p => p.alias === x.props.alias);
    const dataType = dataTypes.find(d => d.name === x.props.dataType);
    if (!dataType) {
        throw new Error(`Data type ${x.props.dataType} not found`);
    }

    const alias = x.props.alias ?? (await api.getSafeAlias(x.props.label)).alias;

    return {
        alias,
        allowCultureVariant: x.props?.allowCultureVariant ?? false,
        allowSegmentVariant: x.props?.allowSegmentVariant ?? false,
        dataTypeId: +dataType.id,
        description: x.props.description,
        groupId: existingGroup?.id,
        id: existingProperty?.id,
        label: x.props.label,
        labelOnTop: x.props.labelOnTop ?? false,
        sortOrder: x.props.sortOrder,
        validation: {
            mandatory: x.props.validation?.mandatory ?? false,
            mandatoryMessage: x.props.validation?.mandatoryMessage,
            pattern: x.props.validation?.pattern,
            patternMessage: x.props.validation?.patternMessage
        }
    };
}