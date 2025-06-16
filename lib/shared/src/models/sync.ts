import { Observable } from 'observable-fns'
import { distinctUntilChanged, shareReplay } from '../misc/observable'
import { ANSWER_TOKENS } from '../prompt/constants'
import { CHAT_INPUT_TOKEN_BUDGET } from '../token/constants'
import type { Model } from './model'
import type { ModelsData } from './modelsService'
import { ModelTag } from './tags'
import { ModelUsage } from './types'

export const INPUT_TOKEN_FLAG_OFF: number = 45_000

/**
 * Observe the list of all available models.
 */
export function syncModels(): Observable<ModelsData> {
    // Create a single hardcoded model
    const hardcodedModel: Model = {
        id: 'driver',
        provider: 'driver',
        title: 'Driver Model',
        usage: [ModelUsage.Chat, ModelUsage.Edit],
        contextWindow: {
            input: CHAT_INPUT_TOKEN_BUDGET,
            output: ANSWER_TOKENS,
        },
        tags: [ModelTag.Default],
    }

    // Return a simple observable with the hardcoded model
    return new Observable<ModelsData>(subscriber => {
        subscriber.next({
            localModels: [],
            primaryModels: [hardcodedModel],
            preferences: {
                defaults: {
                    chat: hardcodedModel.id,
                    edit: hardcodedModel.id,
                    autocomplete: hardcodedModel.id,
                },
                selected: {},
            },
            isRateLimited: false,
        })
        subscriber.complete()
    }).pipe(distinctUntilChanged(), shareReplay())
}

export interface ChatModelProviderConfig {
    provider: string
    model: string
    inputTokens?: number
    outputTokens?: number
    apiKey?: string
    apiEndpoint?: string
    options?: Record<string, any>
}
