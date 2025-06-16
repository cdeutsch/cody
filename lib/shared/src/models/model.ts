import type {
    ClientSideConfig,
    ContextWindow,
    ModelCapability,
    ModelCategory,
    ModelConfigAllTiers,
    ModelRef,
    ModelRefStr,
    ModelStatus,
    ModelTier,
} from './modelsService'
import type { ModelTag } from './tags'
import type { ModelContextWindow, ModelUsage } from './types'

/**
 * Model describes an LLM model and its capabilities.
 */
export interface Model {
    /**
     * The model name _without_ the provider ID.
     * e.g. "claude-3-sonnet-20240229"
     *
     * TODO(PRIME-282): Replace this with a `ModelRefStr` instance and introduce a separate
     * "modelId" that is distinct from the "modelName". (e.g. "claude-3-sonnet" vs. "claude-3-sonnet-20240229")
     */
    readonly id: string
    /**
     * The usage of the model, e.g. chat or edit.
     */
    readonly usage: ModelUsage[]
    /**
     * The default context window of the model reserved for Chat and Context.
     * {@see TokenCounter on how the token usage is calculated.}
     */
    readonly contextWindow: ModelContextWindow

    /**
     * The client-specific configuration for the model.
     */
    readonly clientSideConfig?: ClientSideConfig

    /**
     * The name of the provider of the model, e.g. "Anthropic"
     */
    readonly provider: string

    /** The title of the model, e.g. "Claude 3 Sonnet" */
    readonly title: string

    /**
     * The tags assigned for categorizing the model.
     */
    readonly tags: ModelTag[]

    readonly modelRef?: ModelRef

    disabled?: boolean
}

export interface ServerModel {
    modelRef: ModelRefStr
    displayName: string
    modelName: string
    capabilities: ModelCapability[]
    category: ModelCategory
    status: ModelStatus
    tier: ModelTier
    modelConfigAllTiers?: ModelConfigAllTiers

    contextWindow: ContextWindow

    clientSideConfig?: ClientSideConfig
}
