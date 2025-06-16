import type { FC } from 'react'

export const LoadingDots: FC = () => {
    return (
        <div className="tw-leading-none tw-inline-flex tw-gap-[3px]">
            <div className="tw-w-[3px] tw-h-[3px] tw-rounded-full tw-bg-sidebar-foreground tw-animate-[loading_1.4s_ease-in-out_infinite]" />
            <div className="tw-w-[3px] tw-h-[3px] tw-rounded-full tw-bg-sidebar-foreground tw-animate-[loading_1.4s_ease-in-out_0.2s_infinite]" />
            <div className="tw-w-[3px] tw-h-[3px] tw-rounded-full tw-bg-sidebar-foreground tw-animate-[loading_1.4s_ease-in-out_0.4s_infinite]" />
        </div>
    )
}
