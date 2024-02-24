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
    icon?: string,
    isElement?: boolean,
    tabs?: Tab[],
    groups?: Group[]
}> {}

export class Tab extends Base<{
    alias?: string,
    name: string,
    sortOrder?: number,
    groups: Group[],
}> {}

export class Group extends Base<{
    alias?: string,
    name: string,
    sortOrder?: number,
    properties: Property[],
}> {}

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
}> {}