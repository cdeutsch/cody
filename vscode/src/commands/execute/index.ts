import { type ContextItem, PromptString, ps } from '@sourcegraph/cody-shared'

export function selectedCodePromptWithExtraFiles(
    primary: ContextItem,
    other: ContextItem[]
): PromptString {
    const primaryMention = ps`@${PromptString.fromDisplayPathLineRange(primary.uri, primary.range)}`
    const otherMentions = other.map(
        item => ps`@${PromptString.fromDisplayPathLineRange(item.uri, item.range)}`
    )
    return PromptString.join([primaryMention, ...otherMentions], ps` `)
}
