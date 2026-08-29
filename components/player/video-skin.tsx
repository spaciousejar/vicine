"use client"

import {
  type CSSProperties,
  type ComponentProps,
  forwardRef,
  type ReactNode,
  useEffect,
  useRef,
} from "react"
import {
  audioText,
  captionsText,
  playbackRateText,
  qualityText,
  settingsText,
  speedText,
} from "@videojs/core/i18n/text/menu"
import {
  AirPlayEnterIcon,
  AirPlayExitIcon,
  CaptionsOffIcon,
  CaptionsOnIcon,
  CastEnterIcon,
  CastExitIcon,
  CheckIcon,
  ChevronIcon,
  FullscreenEnterIcon,
  FullscreenExitIcon,
  GearIcon,
  PauseIcon,
  PipEnterIcon,
  PipExitIcon,
  PlayIcon,
  QualityIcon,
  RestartIcon,
  SpeechIcon,
  SpeedIcon,
  SpinnerIcon,
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeOffIcon,
} from "@videojs/react/icons"
import {
  Poster,
  useTranslator,
  Container,
  usePlayer,
  AirPlayButton,
  BufferingIndicator,
  CaptionsButton,
  CaptionsRadioGroup,
  useCaptionsOptions,
  CastButton,
  Controls,
  ErrorDialog,
  FullscreenButton,
  Gesture,
  Hotkey,
  Menu,
  MuteButton,
  PiPButton,
  PlayButton,
  usePlaybackRateOptions,
  PlaybackRateRadioGroup,
  Popover,
  useQualityOptions,
  QualityRadioGroup,
  SeekIndicator,
  Slider,
  StatusAnnouncer,
  StatusIndicator,
  Time,
  TimeSlider,
  Tooltip,
  VolumeIndicator,
  VolumeSlider,
} from "@videojs/react"
import { Video } from "@videojs/react/video"
import { VideoPlayer as Player } from "@videojs/react/video/player"
import type { SubtitleTrack } from "@/lib/subtitles"
import "./video-skin.css"

const SEEK_TIME = 10

const TOP_STATUS_ACTIONS = [
  "toggleSubtitles",
  "toggleFullscreen",
  "togglePictureInPicture",
] as const

const CENTER_STATUS_ACTIONS = ["togglePaused"] as const

function MenuChevron({ flipped = false }: { flipped?: boolean }): ReactNode {
  return (
    <ChevronIcon
      className={`media-icon media-menu__chevron ${flipped ? "media-icon--flipped" : undefined}`}
    />
  )
}

export interface VideoSkinProps {
  src: string
  poster?: string | undefined
  style?: CSSProperties
  className?: string
  renderPoster?: Poster.Props["render"]
  onError?: () => void
  /** Fired when playback reaches the end of the media. */
  onEnded?: () => void
  /** Text tracks rendered into the media element (uploads + embedded). */
  tracks?: SubtitleTrack[]
  /** Label of the embedded track currently being extracted, if any. */
  extractingLabel?: string | null
  onAddSubtitleFiles?: (files: FileList | null) => void
  /** Alternate renditions (catalog qualities) selectable in the menu. */
  qualities?: { id: string; label: string }[]
  activeQualityId?: string | null
  onQualityChange?: (id: string) => void
  /** Audio tracks discovered for this source (sidecar probe). */
  audioOptions?: { id: string; label: string }[]
  activeAudioId?: string | null
  onAudioChange?: (id: string) => void
}

export function VideoPlayer({
  src,
  poster,
  className,
  renderPoster,
  style,
  onError,
  onEnded,
  tracks,
  extractingLabel,
  onAddSubtitleFiles,
  qualities,
  activeQualityId,
  onQualityChange,
  audioOptions,
  activeAudioId,
  onAudioChange,
}: VideoSkinProps): ReactNode {
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-fit: while fullscreen, fit the video to the screen edge-to-edge in
  // portrait (fill/crop) to avoid huge letterboxing, and contain otherwise.
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(
      ".media-default-skin.media-default-skin--video"
    )
    if (!root) return

    const applyFit = () => {
      const isFs =
        document.fullscreenElement === root ||
        (document as Document & { webkitFullscreenElement?: Element | null })
          .webkitFullscreenElement === root
      const portrait = window.innerHeight > window.innerWidth
      root.style.setProperty(
        "--media-object-fit",
        isFs && portrait ? "fill" : "contain"
      )
    }

    applyFit()
    document.addEventListener("fullscreenchange", applyFit)
    document.addEventListener("webkitfullscreenchange", applyFit)
    window.addEventListener("orientationchange", applyFit)
    window.addEventListener("resize", applyFit)
    return () => {
      document.removeEventListener("fullscreenchange", applyFit)
      document.removeEventListener("webkitfullscreenchange", applyFit)
      window.removeEventListener("orientationchange", applyFit)
      window.removeEventListener("resize", applyFit)
    }
  }, [])

  return (
    <Player poster={poster}>
      <Container
        className={`media-default-skin media-default-skin--video ${className ?? ""}`}
        style={style}
      >
        <Video
          src={src}
          playsInline
          autoPlay
          onEnded={onEnded}
          onError={onError}
        >
          {tracks?.map((t) => (
            <track
              key={t.id}
              kind="subtitles"
              src={t.src || undefined}
              label={t.label}
              srcLang={t.lang}
            />
          ))}
        </Video>

        <input
          ref={inputRef}
          type="file"
          accept=".vtt,.srt,text/vtt,application/x-subrip"
          multiple
          hidden
          onChange={(e) => {
            onAddSubtitleFiles?.(e.target.files)
            e.target.value = ""
          }}
        />

        <Poster render={renderPoster} />

        <BufferingIndicator
          render={(props) => (
            <div {...props} className="media-buffering-indicator">
              {poster ? (
                <img
                  src={poster}
                  alt=""
                  aria-hidden="true"
                  className="media-buffering__backdrop"
                />
              ) : null}
              <div className="media-buffering__content">
                <SpinnerIcon className="media-icon media-buffering__spinner" />
                <span className="media-buffering__label">Buffering</span>
              </div>
            </div>
          )}
        />

        <ErrorDialog.Root>
          <ErrorDialog.Popup className="media-error">
            <div className="media-error__dialog media-surface">
              <div className="media-error__content">
                <ErrorDialog.Title className="media-error__title"></ErrorDialog.Title>
                <ErrorDialog.Description className="media-error__description" />
              </div>
              <div className="media-error__actions">
                <ErrorDialog.Close className="media-button media-button--primary"></ErrorDialog.Close>
              </div>
            </div>
          </ErrorDialog.Popup>
        </ErrorDialog.Root>

        <Controls.Root className="media-surface media-controls media-controls--root">
          <Tooltip.Provider>
            <div className="media-surface media-controls media-controls--primary">
              <div className="media-button-group">
                <Tooltip.Root side="top">
                  <Tooltip.Trigger
                    render={
                      <PlayButton
                        className="media-button--play"
                        render={<Button />}
                      >
                        <RestartIcon className="media-icon media-icon--restart" />
                        <PlayIcon className="media-icon media-icon--play" />
                        <PauseIcon className="media-icon media-icon--pause" />
                      </PlayButton>
                    }
                  />
                  <Tooltip.Popup className="media-surface media-tooltip">
                    <Tooltip.Label />
                    <Tooltip.Shortcut className="media-tooltip__kbd" />
                  </Tooltip.Popup>
                </Tooltip.Root>

                <VolumePopover />
              </div>

              <div className="media-time-controls">
                <Time.Value type="current" className="media-time" />
                <TimeSlider.Root className="media-slider">
                  <TimeSlider.Chapters
                    className="media-slider__chapters"
                    renderChapter={(props) => (
                      <div
                        {...props}
                        className={`${props.className} media-slider__chapter`}
                      >
                        <TimeSlider.Track className="media-slider__track media-slider__chapter-track">
                          <TimeSlider.Buffer className="media-slider__buffer" />
                          <TimeSlider.Fill className="media-slider__fill" />
                        </TimeSlider.Track>
                      </div>
                    )}
                  />
                  <TimeSlider.Thumb className="media-slider__thumb" />

                  <TimeSlider.Preview
                    overflow="visible"
                    className="media-slider__preview"
                  >
                    <div className="media-surface media-thumbnail media-slider__thumbnail">
                      <Slider.Thumbnail className="media-thumbnail__image" />
                      <SpinnerIcon className="media-thumbnail__spinner media-icon" />
                    </div>
                    <div className="media-slider__value">
                      <TimeSlider.ChapterTitle className="media-slider__chapter-title" />
                      <TimeSlider.Value type="pointer" className="media-time" />
                    </div>
                  </TimeSlider.Preview>
                </TimeSlider.Root>
                <Time.Value toggle type="remaining" className="media-time" />
              </div>

              <div className="media-button-group">
                <Tooltip.Root side="top">
                  <Tooltip.Trigger
                    render={
                      <CaptionsButton
                        className="media-button--captions"
                        render={<Button />}
                      >
                        <CaptionsOffIcon className="media-icon media-icon--captions-off" />
                        <CaptionsOnIcon className="media-icon media-icon--captions-on" />
                      </CaptionsButton>
                    }
                  />
                  <Tooltip.Popup className="media-surface media-tooltip">
                    <Tooltip.Label />
                    <Tooltip.Shortcut className="media-tooltip__kbd" />
                  </Tooltip.Popup>
                </Tooltip.Root>

                <SettingsMenu
                  extractingLabel={extractingLabel}
                  onLoadSubtitleFiles={() => inputRef.current?.click()}
                  qualities={qualities}
                  activeQualityId={activeQualityId}
                  onQualityChange={onQualityChange}
                  audioOptions={audioOptions}
                  activeAudioId={activeAudioId}
                  onAudioChange={onAudioChange}
                />
              </div>
            </div>

            <div className="media-surface media-controls media-controls--secondary">
              <div className="media-button-group">
                <CastControl />
                <AirPlayControl />
                <PiPControl />
                <FullscreenControl />
              </div>
            </div>
          </Tooltip.Provider>
        </Controls.Root>

        <div className="media-overlay" />

        {/* Hotkeys */}
        <Hotkey keys="Space" action="togglePaused" />
        <Hotkey keys="k" action="togglePaused" />
        <Hotkey keys="m" action="toggleMuted" />
        <Hotkey keys="f" action="toggleFullscreen" />
        <Hotkey keys="c" action="toggleSubtitles" />
        <Hotkey keys="i" action="togglePictureInPicture" />
        <Hotkey keys="ArrowRight" action="seekStep" value={SEEK_TIME / 2} />
        <Hotkey keys="ArrowLeft" action="seekStep" value={-(SEEK_TIME / 2)} />
        <Hotkey keys="l" action="seekStep" value={SEEK_TIME} />
        <Hotkey keys="j" action="seekStep" value={-SEEK_TIME} />
        <Hotkey keys="ArrowUp" action="volumeStep" value={0.05} />
        <Hotkey keys="ArrowDown" action="volumeStep" value={-0.05} />
        <Hotkey keys="0-9" action="seekToPercent" />
        <Hotkey keys="Home" action="seekToPercent" value={0} />
        <Hotkey keys="End" action="seekToPercent" value={100} />
        <Hotkey keys=">" action="speedUp" />
        <Hotkey keys="<" action="speedDown" />

        {/* Gestures */}
        <Gesture
          type="tap"
          action="togglePaused"
          pointer="mouse"
          region="center"
        />
        <Gesture type="tap" action="toggleControls" pointer="touch" />
        <Gesture
          type="doubletap"
          action="seekStep"
          value={-SEEK_TIME}
          region="left"
        />
        <Gesture type="doubletap" action="toggleFullscreen" region="center" />
        <Gesture
          type="doubletap"
          action="seekStep"
          value={SEEK_TIME}
          region="right"
        />

        {/* Input Indicators */}
        <StatusAnnouncer className="media-sr-only" />
        <div className="media-input-indicator-overlay">
          <VolumeIndicator.Root className="media-surface media-volume-indicator">
            <VolumeIndicator.Fill className="media-volume-indicator__content">
              <VolumeHighIcon className="media-icon media-icon--volume-high" />
              <VolumeLowIcon className="media-icon media-icon--volume-low" />
              <VolumeOffIcon className="media-icon media-icon--volume-off" />
              <VolumeIndicator.Value className="media-volume-indicator__value" />
            </VolumeIndicator.Fill>
          </VolumeIndicator.Root>

          <StatusIndicator.Root
            actions={TOP_STATUS_ACTIONS}
            className="media-surface media-status-indicator media-status-indicator--state"
          >
            <div className="media-status-indicator__content">
              <CaptionsOnIcon className="media-icon media-icon--captions-on" />
              <CaptionsOffIcon className="media-icon media-icon--captions-off" />
              <FullscreenEnterIcon className="media-icon media-icon--fullscreen-enter" />
              <FullscreenExitIcon className="media-icon media-icon--fullscreen-exit" />
              <PipEnterIcon className="media-icon media-icon--pip-enter" />
              <PipExitIcon className="media-icon media-icon--pip-exit" />
              <StatusIndicator.Value className="media-status-indicator__value" />
            </div>
          </StatusIndicator.Root>

          <SeekIndicator.Root className="media-seek-indicator">
            <ChevronIcon className="media-icon media-icon--seek" />
            <SeekIndicator.Value className="media-seek-indicator__value" />
          </SeekIndicator.Root>

          <StatusIndicator.Root
            actions={CENTER_STATUS_ACTIONS}
            className="media-status-indicator media-status-indicator--playback"
          >
            <PlayIcon className="media-icon media-icon--play" />
            <PauseIcon className="media-icon media-icon--pause" />
          </StatusIndicator.Root>
        </div>
      </Container>
    </Player>
  )
}

// ================================================================
// Menus
// ================================================================

interface QualityOptionLite {
  id: string
  label: string
}

interface SettingsMenuProps {
  extractingLabel?: string | null
  onLoadSubtitleFiles: () => void
  qualities?: QualityOptionLite[]
  activeQualityId?: string | null
  onQualityChange?: (id: string) => void
  audioOptions?: { id: string; label: string }[]
  activeAudioId?: string | null
  onAudioChange?: (id: string) => void
}

function SettingsMenu({
  extractingLabel,
  onLoadSubtitleFiles,
  qualities,
  activeQualityId,
  onQualityChange,
  audioOptions,
  activeAudioId,
  onAudioChange,
}: SettingsMenuProps): ReactNode {
  const t = useTranslator()
  const playbackRate = usePlaybackRateOptions()
  const quality = useQualityOptions()
  const captions = useCaptionsOptions()
  const hasPlaybackRate = playbackRate?.state.availability === "available"
  const hasQuality = quality?.state.availability === "available"
  const hasCaptions = captions?.state.availability === "available"

  const hasCustomGroups =
    (qualities?.length ?? 0) > 1 ||
    (audioOptions?.length ?? 0) > 1 ||
    Boolean(onLoadSubtitleFiles)

  if (!hasPlaybackRate && !hasQuality && !hasCaptions && !hasCustomGroups)
    return null

  return (
    <Menu.Root side="top" align="center">
      <Tooltip.Root side="top">
        <Tooltip.Trigger
          render={
            <Menu.Trigger
              aria-label={t(settingsText)}
              className="media-button--settings"
              render={<Button />}
            >
              <GearIcon className="media-icon media-icon--settings" />
            </Menu.Trigger>
          }
        />
        <Tooltip.Popup className="media-surface media-tooltip">
          <Tooltip.Label>{t(settingsText) ?? ""}</Tooltip.Label>
        </Tooltip.Popup>
      </Tooltip.Root>
      <Menu.Content className="media-surface media-popover media-menu media-menu--settings">
        <div className="media-menu__group">
          {qualities && qualities.length > 1 ? (
            <Menu.Root>
              <Menu.Trigger
                className="media-menu__item media-menu__item--submenu"
                render={(props) => (
                  <div {...props}>
                    <QualityIcon className="media-icon" />
                    <span>{t(qualityText)}</span>
                    <span className="media-menu__hint">
                      <bdi dir="auto" className="media-menu__hint-label">
                        {qualities.find((q) => q.id === activeQualityId)
                          ?.label ?? qualities[0].label}
                      </bdi>
                      <MenuChevron />
                    </span>
                  </div>
                )}
              />
              <Menu.Content className="media-menu__panel">
                <Menu.Item className="media-menu__back">
                  <MenuChevron flipped />
                  {t(qualityText)}
                </Menu.Item>
                <Menu.Separator className="media-menu__separator" />
                <Menu.RadioGroup
                  className="media-menu__group"
                  aria-label={t(qualityText)}
                  value={activeQualityId ?? ""}
                  onValueChange={(value) => {
                    if (value !== activeQualityId) onQualityChange?.(value)
                  }}
                >
                  {qualities.map((q) => (
                    <Menu.RadioItem
                      key={q.id}
                      className="media-menu__item"
                      value={q.id}
                      onSelect={() => onQualityChange?.(q.id)}
                    >
                      <bdi dir="auto">{q.label}</bdi>
                      <Menu.ItemIndicator
                        forceMount
                        className="media-menu__indicator"
                      >
                        <CheckIcon className="media-icon" />
                      </Menu.ItemIndicator>
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioGroup>
              </Menu.Content>
            </Menu.Root>
          ) : null}

          {/* Subtitle loading is always reachable, even with zero tracks. */}
          {extractingLabel ? (
            <div className="media-menu__item" role="status">
              <SpinnerIcon className="media-icon" />
              <span>Extracting “{extractingLabel}”…</span>
            </div>
          ) : null}

          {hasCaptions ? (
            <Menu.Root>
              <Menu.Trigger
                className="media-menu__item media-menu__item--submenu"
                render={(props) => (
                  <div {...props}>
                    <CaptionsOffIcon className="media-icon" />
                    <span>{t(captionsText)}</span>
                    <span className="media-menu__hint">
                      <bdi dir="auto" className="media-menu__hint-label">
                        {extractingLabel
                          ? "Extracting…"
                          : captions.selectedLabel}
                      </bdi>
                      <MenuChevron />
                    </span>
                  </div>
                )}
              />
              <Menu.Content className="media-menu__panel">
                <Menu.Item className="media-menu__back">
                  <MenuChevron flipped />
                  {t(captionsText)}
                </Menu.Item>
                <Menu.Separator className="media-menu__separator" />
                <CaptionsRadioGroup
                  className="media-menu__group"
                  aria-label={t(captionsText)}
                  renderItem={(props, item) => (
                    <Menu.RadioItem {...props} className="media-menu__item">
                      <bdi dir="auto">{item.label}</bdi>
                      <Menu.ItemIndicator
                        checked={item.checked}
                        forceMount
                        className="media-menu__indicator"
                      >
                        <CheckIcon className="media-icon" />
                      </Menu.ItemIndicator>
                    </Menu.RadioItem>
                  )}
                />
              </Menu.Content>
            </Menu.Root>
          ) : null}

          {hasQuality ? (
            <Menu.Root>
              <Menu.Trigger
                className="media-menu__item media-menu__item--submenu"
                render={(props) => (
                  <div {...props}>
                    <QualityIcon className="media-icon" />
                    <span>{t(qualityText)}</span>
                    <span className="media-menu__hint">
                      <bdi dir="auto" className="media-menu__hint-label">
                        {quality.selectedLabel}
                      </bdi>
                      <MenuChevron />
                    </span>
                  </div>
                )}
              />
              <Menu.Content className="media-menu__panel">
                <Menu.Item className="media-menu__back">
                  <MenuChevron flipped />
                  {t(qualityText)}
                </Menu.Item>
                <Menu.Separator className="media-menu__separator" />
                <QualityRadioGroup
                  className="media-menu__group"
                  aria-label={t(qualityText)}
                  renderItem={(props, item) => (
                    <Menu.RadioItem {...props} className="media-menu__item">
                      <bdi dir="auto">
                        {item.label}
                        {item.tier ? (
                          <sup className="media-menu__tier">{item.tier}</sup>
                        ) : null}
                      </bdi>
                      {item.badge ? (
                        <span className="media-badge">{item.badge}</span>
                      ) : null}
                      <Menu.ItemIndicator
                        checked={item.checked}
                        forceMount
                        className="media-menu__indicator"
                      >
                        <CheckIcon className="media-icon" />
                      </Menu.ItemIndicator>
                    </Menu.RadioItem>
                  )}
                />
              </Menu.Content>
            </Menu.Root>
          ) : null}

          {audioOptions && audioOptions.length > 1 ? (
            <Menu.Root>
              <Menu.Trigger
                className="media-menu__item media-menu__item--submenu"
                render={(props) => (
                  <div {...props}>
                    <SpeechIcon className="media-icon" />
                    <span>{t(audioText)}</span>
                    <span className="media-menu__hint">
                      <bdi dir="auto" className="media-menu__hint-label">
                        {audioOptions.find((a) => a.id === activeAudioId)
                          ?.label ?? audioOptions[0].label}
                      </bdi>
                      <MenuChevron />
                    </span>
                  </div>
                )}
              />
              <Menu.Content className="media-menu__panel">
                <Menu.Item className="media-menu__back">
                  <MenuChevron flipped />
                  {t(audioText)}
                </Menu.Item>
                <Menu.Separator className="media-menu__separator" />
                <Menu.RadioGroup
                  className="media-menu__group"
                  aria-label={t(audioText)}
                  value={activeAudioId ?? ""}
                  onValueChange={(value) => onAudioChange?.(value)}
                >
                  {audioOptions.map((a) => (
                    <Menu.RadioItem
                      key={a.id}
                      className="media-menu__item"
                      value={a.id}
                      onSelect={() => onAudioChange?.(a.id)}
                    >
                      <bdi dir="auto">{a.label}</bdi>
                      <Menu.ItemIndicator
                        forceMount
                        className="media-menu__indicator"
                      >
                        <CheckIcon className="media-icon" />
                      </Menu.ItemIndicator>
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioGroup>
              </Menu.Content>
            </Menu.Root>
          ) : null}

          {hasPlaybackRate ? (
            <Menu.Root>
              <Menu.Trigger
                className="media-menu__item media-menu__item--submenu"
                render={(props) => (
                  <div {...props}>
                    <SpeedIcon className="media-icon" />
                    <span>{t(speedText)}</span>
                    <span className="media-menu__hint">
                      <bdi dir="auto" className="media-menu__hint-label">
                        {playbackRate.selectedLabel}
                      </bdi>
                      <MenuChevron />
                    </span>
                  </div>
                )}
              />
              <Menu.Content className="media-menu__panel">
                <Menu.Item className="media-menu__back">
                  <MenuChevron flipped />
                  {t(speedText)}
                </Menu.Item>
                <Menu.Separator className="media-menu__separator" />
                <PlaybackRateRadioGroup
                  className="media-menu__group"
                  aria-label={t(playbackRateText)}
                  renderItem={(props, item) => (
                    <Menu.RadioItem {...props} className="media-menu__item">
                      <bdi dir="auto">{item.label}</bdi>
                      <Menu.ItemIndicator
                        checked={item.checked}
                        forceMount
                        className="media-menu__indicator"
                      >
                        <CheckIcon className="media-icon" />
                      </Menu.ItemIndicator>
                    </Menu.RadioItem>
                  )}
                />
              </Menu.Content>
            </Menu.Root>
          ) : null}
        </div>
      </Menu.Content>
    </Menu.Root>
  )
}

function CastControl() {
  return (
    <Tooltip.Root side="top">
      <Tooltip.Trigger
        render={
          <CastButton className="media-button--cast" render={<Button />}>
            <CastEnterIcon className="media-icon media-icon--cast-enter" />
            <CastExitIcon className="media-icon media-icon--cast-exit" />
          </CastButton>
        }
      />
      <Tooltip.Popup className="media-surface media-tooltip">
        <Tooltip.Label />
        <Tooltip.Shortcut className="media-tooltip__kbd" />
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}

function AirPlayControl() {
  return (
    <Tooltip.Root side="top">
      <Tooltip.Trigger
        render={
          <AirPlayButton className="media-button--airplay" render={<Button />}>
            <AirPlayEnterIcon className="media-icon media-icon--airplay-enter" />
            <AirPlayExitIcon className="media-icon media-icon--airplay-exit" />
          </AirPlayButton>
        }
      />
      <Tooltip.Popup className="media-surface media-tooltip">
        <Tooltip.Label />
        <Tooltip.Shortcut className="media-tooltip__kbd" />
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}

function PiPControl() {
  return (
    <Tooltip.Root side="top">
      <Tooltip.Trigger
        render={
          <PiPButton className="media-button--pip" render={<Button />}>
            <PipEnterIcon className="media-icon media-icon--pip-enter" />
            <PipExitIcon className="media-icon media-icon--pip-exit" />
          </PiPButton>
        }
      />
      <Tooltip.Popup className="media-surface media-tooltip">
        <Tooltip.Label />
        <Tooltip.Shortcut className="media-tooltip__kbd" />
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}

function FullscreenControl() {
  return (
    <Tooltip.Root side="top">
      <Tooltip.Trigger
        render={
          <FullscreenButton
            className="media-button--fullscreen"
            render={<Button />}
          >
            <FullscreenEnterIcon className="media-icon media-icon--fullscreen-enter" />
            <FullscreenExitIcon className="media-icon media-icon--fullscreen-exit" />
          </FullscreenButton>
        }
      />
      <Tooltip.Popup className="media-surface media-tooltip">
        <Tooltip.Label />
        <Tooltip.Shortcut className="media-tooltip__kbd" />
      </Tooltip.Popup>
    </Tooltip.Root>
  )
}

// ================================================================
// Components
// ================================================================

const Button = forwardRef<HTMLButtonElement, ComponentProps<"button">>(
  function Button({ className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={`media-button media-button--subtle media-button--icon ${className ?? ""}`}
        {...props}
      />
    )
  }
)

function VolumePopover(): ReactNode {
  const volumeUnavailable = usePlayer(
    (s) => s.volumeAvailability !== "available"
  )

  const muteButton = (
    <MuteButton className="media-button--mute" render={<Button />}>
      <VolumeOffIcon className="media-icon media-icon--volume-off" />
      <VolumeLowIcon className="media-icon media-icon--volume-low" />
      <VolumeHighIcon className="media-icon media-icon--volume-high" />
    </MuteButton>
  )

  if (volumeUnavailable) return muteButton

  return (
    <Popover.Root openOnHover delay={200} closeDelay={100} side="top">
      <Popover.Trigger render={muteButton} />
      <Popover.Popup className="media-surface media-popover media-popover--volume">
        <VolumeSlider.Root
          className="media-slider"
          orientation="vertical"
          thumbAlignment="edge"
        >
          <VolumeSlider.Track className="media-slider__track">
            <VolumeSlider.Fill className="media-slider__fill" />
          </VolumeSlider.Track>
          <VolumeSlider.Thumb className="media-slider__thumb media-slider__thumb--persistent" />
        </VolumeSlider.Root>
      </Popover.Popup>
    </Popover.Root>
  )
}
