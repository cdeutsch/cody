export interface ClientConfig {
    // Whether the site admin allows this user to make use of the Driver chat feature.
    chatEnabled: boolean

    // Whether the site admin allows this user to make use of the Driver autocomplete feature.
    autoCompleteEnabled: boolean

    // Whether the site admin allows the user to make use of the **custom** Driver commands feature.
    customCommandsEnabled: boolean
}
