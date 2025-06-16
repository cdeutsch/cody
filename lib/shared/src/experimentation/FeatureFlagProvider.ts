import { Observable, Subject, interval, map } from 'observable-fns'
import { authStatus } from '../auth/authStatus'
import type { AuthStatus, AuthenticatedAuthStatus } from '../auth/types'
import { logError } from '../logger'
import {
    type StoredLastValue,
    combineLatest,
    concat,
    debounceTime,
    distinctUntilChanged,
    firstValueFrom,
    promiseFactoryToObservable,
    shareReplay,
    startWith,
    storeLastValue,
    switchMap,
} from '../misc/observable'
import { wrapInActiveSpan } from '../tracing'
import { isError } from '../utils'

export enum FeatureFlag {
    // This flag is only used for testing the behavior of the provider and should not be used in
    // product code
    TestFlagDoNotUse = 'test-flag-do-not-use',

    // Enable both-client side and server-side tracing
    DriverAutocompleteTracing = 'driver-autocomplete-tracing',
    // This flag is used to track the overall eligibility to use the StarCoder model. The `-hybrid`
    // suffix is no longer relevant
    DriverAutocompleteStarCoderHybrid = 'driver-autocomplete-default-starcoder-hybrid',
    // Enable the deepseek-v2 as the default model via Fireworks
    DriverAutocompleteDeepseekV2LiteBase = 'driver-autocomplete-deepseek-v2-lite-base',

    // Data collection variants used for completions and next edit completions
    DriverAutocompleteDataCollectionFlag = 'driver-autocomplete-logs-collection-flag',
    SmartApplyContextDataCollectionFlag = 'driver-smart-apply-context-logs-collection-flag',
    EditContextDataCollectionFlag = 'driver-edit-context-logs-collection-flag',

    // Enables fast-path HTTP client for PLG-users
    DriverAutocompleteFastPath = 'driver-autocomplete-fast-path',

    // Enable various feature flags to experiment with FIM trained fine-tuned models via Fireworks
    DriverAutocompleteFIMModelExperimentBaseFeatureFlag = 'driver-autocomplete-model-v2-experiment-flag',
    DriverAutocompleteFIMModelExperimentControl = 'driver-autocomplete-model-experiment-control',
    DriverAutocompleteFIMModelExperimentCurrentBest = 'driver-autocomplete-model-experiment-current-best',
    DriverAutocompleteFIMModelExperimentVariant1 = 'driver-autocomplete-model-experiment-variant-1',
    DriverAutocompleteFIMModelExperimentVariant2 = 'driver-autocomplete-model-experiment-variant-2',
    DriverAutocompleteFIMModelExperimentVariant3 = 'driver-autocomplete-model-experiment-variant-3',
    DriverAutocompleteFIMModelExperimentVariant4 = 'driver-autocomplete-model-experiment-variant-4',

    DriverAutocompleteContextExperimentBaseFeatureFlag = 'driver-autocomplete-context-experiment-flag',
    DriverAutocompleteContextExperimentVariant1 = 'driver-autocomplete-context-experiment-variant-1',
    DriverAutocompleteContextExperimentVariant2 = 'driver-autocomplete-context-experiment-variant-2',
    DriverAutocompleteContextExperimentVariant3 = 'driver-autocomplete-context-experiment-variant-3',
    DriverAutocompleteContextExperimentVariant4 = 'driver-autocomplete-context-experiment-variant-4',
    DriverAutocompleteContextExperimentControl = 'driver-autocomplete-context-experiment-control',

    DriverSmartApplyInstantModeEnabled = 'driver-smart-apply-instant-mode-enabled',
    DriverSmartApplyExperimentEnabledFeatureFlag = 'driver-smart-apply-experiment-enabled-flag',
    DriverSmartApplyExperimentVariant1 = 'driver-smart-apply-experiment-variant-1',
    DriverSmartApplyExperimentVariant2 = 'driver-smart-apply-experiment-variant-2',
    DriverSmartApplyExperimentVariant3 = 'driver-smart-apply-experiment-variant-3',
    DriverSmartApplyPrefetching = 'driver-smart-apply-prefetching',

    DriverAutoEditExperimentEnabledFeatureFlag = 'driver-autoedit-experiment-enabled-flag',

    // Enables hot-streak for autoedit suggestions
    DriverAutoEditHotStreak = 'driver-autoedit-hot-streak-v2',

    // Enables gpt-4o-mini as a default Edit model
    DriverEditDefaultToGpt4oMini = 'driver-edit-default-to-gpt-4o-mini',

    // Enables Claude 3.5 Haiku as a default Chat model
    DriverChatDefaultToClaude35Haiku = 'driver-chat-default-to-claude-3-5-haiku',

    // use-ssc-for-driver-subscription is a feature flag that enables the use of SSC as the source of truth for Driver subscription data.
    UseSscForDriverSubscription = 'use-ssc-for-driver-subscription',

    // driver-pro-trial-ended is a feature flag that indicates if the Driver Pro "Free Trial"  has ended.
    // (Enabling users to use Driver Pro for free for 3-months starting in late Q4'2023.)
    DriverProTrialEnded = 'driver-pro-trial-ended',

    GitMentionProvider = 'git-mention-provider',

    /** Enable debug mode for One Box feature in Driver */
    DriverExperimentalOneBoxDebug = 'driver-experimental-one-box-debug',
    /** Enable use of new prosemirror prompt editor */
    DriverExperimentalPromptEditor = 'driver-experimental-prompt-editor',

    /** Whether user has access to early-access models. */
    DriverEarlyAccess = 'driver-early-access',

    /**
     * Enables experimental unified prompts (show no commands and include
     * some standard out-of-the-box prompts like documentation and explain code prompts)
     */
    DriverUnifiedPrompts = 'driver-unified-prompts',
    DriverDeepSeekChat = 'driver-deepseek-chat',

    // Enables Anthropic's prompt caching feature on messages for Driver Clients
    DriverPromptCachingOnMessages = 'driver-experimental-prompt-caching-on-messages',

    /** Whether user has access to the experimental agentic chat (fka Deep Driver) feature.
     * This replaces the old 'driver-deep-reflection' & 'deep-driver' that was used for internal testing.
     */
    DeepDriver = 'agentic-chat-experimental',

    /** Enable terminal access for agentic context */
    DeepDriverShellContext = 'agentic-chat-cli-tool-experimental',

    /** Whether Context Agent (Deep Driver) should use the default chat model or 3.5 Haiku */
    ContextAgentDefaultChatModel = 'agentic-chat-use-default-chat-model',

    /**
     * Whether the current repo context chip is shown in the chat input by default
     */
    NoDefaultRepoChip = 'no-default-repo-chip',

    /**
     * Whether the user will see the CTA about upgrading to Sourcegraph Teams
     */
    SourcegraphTeamsUpgradeCTA = 'teams-upgrade-available-cta-editors',

    /**
     * Auto generate short description for chat as title.
     */
    ChatTitleAutoGeneration = 'chat-title-auto-generation',

    /**
     * Use websocket to connect to LLM providers (only fireworks provider for auto-edit currently). The websocket address
     * is configured with the following setting.
     * "driver.experimental.autoedit.config.override": {
     *   "provider": "fireworks-websocket"
     *   "webSocketEndpoint": "ws://0.0.0.0:3000",
     * }
     * When enabled, Driver connects to a WebSocket to HTTP proxy which connects to fireworks directly.
     * Both the WebSocket connection and HTTP (from proxy) use long-lived connection to reduce cross-request
     * latency.
     */
    DriverAutoEditUseWebSocketForFireworksConnections = 'auto-edit-use-web-socket-for-connections',

    // Extend context window for Driver Clients
    EnhancedContextWindow = 'enhanced-context-window',

    // Fallback to Flash when rate limited
    FallbackToFlash = 'fallback-to-flash',

    /**
     * Internal use only. Enables the next agentic chat experience.
     * This is not for external use and should not be exposed to users.
     */
    NextAgenticChatInternal = 'next-agentic-chat-internal',

    /**
     * Allow Deep Driver to use MCP tools during context fetching steps.
     */
    AgenticChatWithMCP = 'agentic-chat-mcp-enabled',

    /**
     * Disable agentic context for chat - Deep Driver disabled
     * When set to true, context will not be added to chat automatically.
     */
    AgenticContextDisabled = 'agentic-context-disabled',
}

const ONE_HOUR = 60 * 60 * 1000

export interface FeatureFlagProvider {
    /**
     * Watch a feature flag's value.
     *
     * This is the preferred way to read feature flags because it means that users do not need to
     * reload their editor to get the changed behavior if the feature flag value changes on the
     * server.
     */
    evaluatedFeatureFlag(flag: FeatureFlag): Observable<boolean>

    /**
     * Get a feature flag's current value once by performing a roundtrip to the server. The caller
     * MUST treat the value as ephemeral (i.e., only valid at the instant it was fetched).
     *
     * @deprecated Use {@link FeatureFlagProvider.evaluatedFeatureFlag} instead. It's important to
     * *watch* feature flag values and change behavior if the feature flag value changes, not just
     * to read the value once (and require the user to reload their editor, for example, to pick up
     * new behavior).
     */
    evaluateFeatureFlagEphemerally(flag: FeatureFlag): Promise<boolean>

    getExposedExperiments(serverEndpoint: string): Record<string, boolean>
    refresh(): void
}

export class FeatureFlagProviderImpl implements FeatureFlagProvider {
    /**
     * The cached exposed feature flags are ones where the backend returns a non-null value and thus
     * we know the user is in either the test or control group.
     *
     * The first key maps to the endpoint so that we never cache the wrong flag for different
     * endpoints.
     */
    private cache: Record<string, boolean> | undefined = undefined

    private refreshRequests = new Subject<void>()
    private refreshes: Observable<void> = combineLatest(
        this.refreshRequests.pipe(startWith(undefined)),
        interval(ONE_HOUR).pipe(startWith(undefined))
    ).pipe(map(() => undefined))

    private relevantAuthStatusChanges: Observable<
        Pick<AuthStatus, 'authenticated'> & Partial<Pick<AuthenticatedAuthStatus, 'user'>>
    > = authStatus.pipe(
        map(authStatus => ({
            authenticated: authStatus.authenticated,
            user: authStatus.authenticated ? authStatus.user : undefined,
        })),
        distinctUntilChanged()
    )

    private evaluatedFeatureFlags: Observable<Record<string, boolean>> = combineLatest(
        this.relevantAuthStatusChanges,
        this.refreshes
    ).pipe(
        debounceTime(0),
        switchMap(([authStatus]) =>
            promiseFactoryToObservable(
                // FUTURE: Support server-side feature flags?
                signal => (process.env.DISABLE_FEATURE_FLAGS ? Promise.resolve({}) : Promise.resolve({})) // graphqlClient.getEvaluatedFeatureFlags(signal)
            ).pipe(
                map(resultOrError => {
                    if (isError(resultOrError)) {
                        logError(
                            'FeatureFlagProvider',
                            'Failed to get all evaluated feature flags',
                            resultOrError
                        )
                    }

                    // Cache so that FeatureFlagProvider.getExposedExperiments can return these synchronously.
                    const result = isError(resultOrError) ? {} : resultOrError
                    this.cache = result
                    return result
                })
            )
        ),
        distinctUntilChanged(),
        shareReplay()
    )

    public getExposedExperiments(serverEndpoint: string): Record<string, boolean> {
        return this.cache || {}
    }

    /**
     * @deprecated See {@link FeatureFlagProvider.evaluateFeatureFlagEphemerally} for notes. Use
     * {@link FeatureFlagProvider.evaluatedFeatureFlag} instead.
     */
    public async evaluateFeatureFlagEphemerally(flagName: FeatureFlag): Promise<boolean> {
        return wrapInActiveSpan(`FeatureFlagProvider.evaluateFeatureFlag.${flagName}`, () =>
            firstValueFrom(this.evaluatedFeatureFlag(flagName))
        )
    }

    private evaluatedFeatureFlagCache: Partial<Record<FeatureFlag, StoredLastValue<boolean>>> = {}

    /**
     * Observe the evaluated value of a feature flag.
     * @param flagName - The feature flag to evaluate
     * @param forceRefresh - When set to true, forces a refresh of the feature flag value. Useful for new feature flags that are frequently toggled.
     * @returns An Observable that emits the current value of the feature flag
     */
    public evaluatedFeatureFlag(flagName: FeatureFlag, forceRefresh = false): Observable<boolean> {
        let entry = this.evaluatedFeatureFlagCache[flagName]

        if (!entry || forceRefresh) {
            // Whenever the auth status changes, we need to call `evaluateFeatureFlag` on the GraphQL
            // endpoint, because our endpoint or authentication may have changed, and
            // `getEvaluatedFeatureFlags` only returns the set of recently evaluated feature flags.
            entry = storeLastValue(
                combineLatest(this.relevantAuthStatusChanges, this.refreshes)
                    .pipe(
                        // NOTE(sqs): Use switchMap instead of switchMapReplayOperation because we want
                        // to cache the previous value while we are refreshing it. That is a choice that
                        // may not always be correct, but it's probably more desirable for more feature
                        // flags. We can make the cache retrieval behavior configurable if needed.
                        switchMap(([authStatus]) =>
                            concat(
                                promiseFactoryToObservable(async signal => {
                                    if (process.env.DISABLE_FEATURE_FLAGS) {
                                        return false
                                    }

                                    const cachedValue = this.cache?.[flagName.toString()]
                                    if (cachedValue !== undefined) {
                                        // We'll immediately return the cached value and then start observing
                                        // for updates.
                                        return cachedValue
                                    }

                                    // FUTURE: Support server-side feature flags?
                                    // const result = await graphqlClient.evaluateFeatureFlag(flagName, signal);
                                    // return isError(result) ? false : (result ?? false);

                                    return false
                                }),
                                this.evaluatedFeatureFlags.pipe(
                                    map(featureFlags => Boolean(featureFlags[flagName.toString()]))
                                )
                            )
                        )
                    )
                    .pipe(distinctUntilChanged(), shareReplay())
            )
            this.evaluatedFeatureFlagCache[flagName] = entry
        }

        return entry.observable
    }

    public refresh(): void {
        this.refreshRequests.next()
    }

    public dispose(): void {
        for (const [, entry] of Object.entries(this.evaluatedFeatureFlagCache)) {
            entry.subscription.unsubscribe()
        }
        this.evaluatedFeatureFlagCache = {}
    }
}

const noopFeatureFlagProvider: FeatureFlagProvider = {
    evaluateFeatureFlagEphemerally: async () => false,
    evaluatedFeatureFlag: () => Observable.of(false),
    getExposedExperiments: () => ({}),
    refresh: () => {},
}

export const featureFlagProvider = process.env.DISABLE_FEATURE_FLAGS
    ? noopFeatureFlagProvider
    : new FeatureFlagProviderImpl()
