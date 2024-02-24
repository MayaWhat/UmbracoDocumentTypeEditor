import * as umbracoModels from './models/umbraco';

export function removeInheritedGroupsAndProperties(groups: umbracoModels.PropertyGroupDisplay<umbracoModels.PropertyTypeDisplay>[], removeAllInheritedTabs?: boolean) {
    const cleanedGroups = groups.filter(x => x.type === 'Group').map(x => {
        const cleaned = removeInheritedPropertiesFromGroup(x);

        if (x.inherited) {
            if (cleaned.properties.length == 0) {
                return null
            }
        }

        return cleaned;        
    }).filter(x => !!x) as umbracoModels.PropertyGroupDisplay<umbracoModels.PropertyTypeDisplay>[];

    const cleanedTabs = groups.filter(x => x.type === 'Tab').map(x => {
        return (!x.inherited || (!removeAllInheritedTabs && cleanedGroups.some(g => g.alias.startsWith(`${x.alias}/`)))) ? x : null;
    }).filter(x => !!x) as umbracoModels.PropertyGroupDisplay<umbracoModels.PropertyTypeDisplay>[];

    return [
        ...cleanedTabs,
        ...cleanedGroups
    ];
}

function removeInheritedPropertiesFromGroup(group: umbracoModels.PropertyGroupDisplay<umbracoModels.PropertyTypeDisplay>) {
    return {
        ...group,
        properties: group.properties.filter(p => !p.inherited)
    };
}

