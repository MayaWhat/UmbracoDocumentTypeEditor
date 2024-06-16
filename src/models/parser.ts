export class Base<T> {
    public props: T;

    constructor(props: T) {
        this.props = props;
    }
}

export class DocumentType extends Base<{
    alias: string,
    name: string,
    allowedTemplates?: string[],
    defaultTemplate?: string,
    allowAsRoot?: boolean,
    allowedChildTypes?: string[],
    allowCultureVariant?: boolean,
    allowSegmentVariant?: boolean,
    compositions?: string[],
    description?: string,
    enableListView?: boolean,
    historyCleanup?: {
        preventCleanup?: boolean,
        keepAllVersionsNewerThanDays?: number,
        keepLatestVersionPerDayForDays?: number,
    },
    icon?: {
        name: string,
        color?: string
    } | string,
    isElement?: boolean,
    tabs?: Tab[],
    groups?: Group[]
}> {
    public static className = 'DocumentType';
}

export class Tab extends Base<{
    alias?: string,
    name: string,
    sortOrder?: number,
    groups: Group[],
}> {
    public static className = 'Tab';
}

export class Group extends Base<{
    alias?: string,
    name: string,
    sortOrder?: number,
    properties: Property[],
}> {
    public static className = 'Group';
}

export class Property extends Base<{
    alias?: string,
    label: string,
    dataType: string,
    allowCultureVariant?: boolean,
    allowSegmentVariant?: boolean,
    description?: string,
    labelOnTop?: boolean,
    sortOrder?: number,
    validation?: {
        mandatory?: boolean,
        mandatoryMessage?: string,
        pattern?: string,
        patternMessage?: string
    }
}> {
    public static className = 'Property';
}