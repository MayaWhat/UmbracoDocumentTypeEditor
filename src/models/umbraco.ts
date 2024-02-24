export type ContentVariation = 'Nothing' | 'Culture' | 'Segment' | 'CultureAndSegment';

export interface SafeAlias {
    alias: string;
    original: string;
    camelCase: boolean;
}

export interface EntityBasic {
    name?: string;
    id: string;
    icon?: string;
    key: string;
    parentId: number;
    alias: string;
    path: string;
    trashed: boolean;
}

export interface EntityBasicWithReadonly extends EntityBasic {
    readonly udi?: string;
    readonly metadata: any;
}

export interface PropertyTypeValidation {
    mandatory: boolean;
    mandatoryMessage?: string;
    pattern?: string;
    patternMessage?: string;
}

export interface PropertyTypeBasic {
    id?: number;
    alias: string;
    description?: string;
    validation: PropertyTypeValidation;
    label: string;
    sortOrder?: number;
    dataTypeId: number;
    groupId?: number;
    allowCultureVariant: boolean;
    allowSegmentVariant: boolean;
    labelOnTop: boolean;
}

export interface PropertyTypeBasicWithReadonly extends PropertyTypeBasic {
    inherited: boolean;
    readonly dataTypeKey: string;
    readonly dataTypeName?: string;
    readonly dataTypeIcon?: string;
}

export interface PropertyTypeDisplay extends PropertyTypeBasicWithReadonly {
    readonly editor?: string;
    readonly view?: string;
    readonly config?: { [key: string]: any };
    readonly locked: boolean;
    readonly contentTypeId: number;
    readonly contentTypeName: string;
}

export interface PropertyGroupBasic<TPropertyType> {
    id?: number;
    key: string;
    type: 'Group' | 'Tab';
    name: string;
    alias: string;
    sortOrder: number;
    properties: TPropertyType[];
}

export interface PropertyGroupDisplay<TPropertyTypeDisplay> extends PropertyGroupBasic<TPropertyTypeDisplay> {  
    inherited: boolean;  
    readonly contentTypeId: number;
    readonly parentTabContentTypes: number[];
    readonly parentTabContentTypeNames: string[];
}

export interface ContentTypeBasic extends Omit<EntityBasic, 'id'> {
    id: number;
    description?: string;
    thumbnail: string;
    variations?: ContentVariation;
    isContainer: boolean;
    isElement: boolean;
}

export interface ContentTypeBasicWithReadonly extends ContentTypeBasic, Omit<EntityBasicWithReadonly, 'id'> {    
    readonly updateDate: string;
    readonly createDate: string;
    readonly iconIsClass: boolean;
    readonly iconFilePath?: string;
    readonly thumbnailIsClass?: boolean;
    readonly thumbnailFilePath?: string;
    readonly blueprints: { [ key: number]: string };
}

export interface BackOfficeNotification {
    header?: string;
    message?: string;
    type: 'Save' | 'Info' | 'Error' | 'Success' | 'Warning';
}

export interface ContentTypeCompositionDisplay<TPropertyTypeDisplay> extends ContentTypeBasicWithReadonly {
    readonly listViewEditorName?: string;
    allowedContentTypes?: number[];
    compositeContentTypes?: string[];
    lockedCompositeContentTypes?: string[];
    allowAsRoot: boolean;
    groups: PropertyGroupDisplay<TPropertyTypeDisplay>[];
    readonly ModelState: any;
    readonly notifications: BackOfficeNotification[];
}

export interface HistoryCleanupViewModel {
    globalEnableCleanup: boolean;
    globalKeepAllVersionsNewerThanDays?: number;
    globalKeepLatestVersionPerDayForDays?: number;
    preventCleanup: boolean;
    keepAllVersionsNewerThanDays?: number;
    keepLatestVersionPerDayForDays?: number;
}

export interface DocumentTypeDisplay extends ContentTypeCompositionDisplay<PropertyTypeDisplay> {
    allowedTemplates: EntityBasic[];
    variations: ContentVariation;
    defaultTemplate?: EntityBasic;
    allowCultureVariant: boolean;
    allowSegmentVariant: boolean;
    apps: [];
    historyCleanup: HistoryCleanupViewModel;
}

export interface TreeNode extends Omit<EntityBasic, 'parentId'> {
    parentId: string;
    hasChildren: boolean;
    nodeType?: string;
    routePath?: string;
    childNodesUrl?: string;
    menuUrl?: string;
    iconIsClass: boolean;
    iconFilePath: string;
    cssClasses?: string[];
}

export interface ContentTypeSave<TPropertyType> extends ContentTypeBasic {
    compositeContentTypes: string[];
    allowAsRoot: boolean;
    allowedContentTypes: number[];
    historyCleanup?: HistoryCleanupViewModel;
    allowCultureVariant: boolean;
    allowSegmentVariant: boolean;
    groups: PropertyGroupBasic<TPropertyType>[];
}

export interface DocumentTypeSave extends ContentTypeSave<PropertyTypeBasic> {
    allowedTemplates?: string[];
    defaultTemplate?: string;
}

export interface DataTypeBasic extends EntityBasic {
    readonly isSystem: boolean;
    readonly group?: string;
    readonly hasPrevalues: boolean;
}

export interface GetAvailableCompositionsFilter {
    contentTypeId: number;
    filterPropertyTypes: string[];
    filterContentTypes: string[];
    isElement: boolean;
}