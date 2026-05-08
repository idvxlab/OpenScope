import { Fragment, type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import type { MappedAction, OcMessage } from '../types/opencode'
import type { AssistantSubtask } from '../utils/subtaskGrouping'
import type { ForkFromActionContext, ForkPanelSnapshotBundle } from '../utils/forkPanelSnapshot'
import SubtaskCard from './SubtaskCard'
import ActionTypeColorLegend from './ActionTypeColorLegend'
import {
  type ActionTypePaletteId,
  DEFAULT_ACTION_TYPE_PALETTE_ID,
  getActionTypeTriad,
} from '../styles/actionTypePalettes'
import { buildMappedActionsFromMessages, collectTaskChildDescriptors } from '../utils/actionMapping'
import { actionKey } from '../utils/actionKey'
import { getMessages } from '../services/opencodeApi'

interface SubtaskDebugPanelProps {
  messages: OcMessage[]
  visibleSubtasks: Array<{ subtask: AssistantSubtask; sourceIndex: number }>
  linkedSubtaskIndex: number | null
  onSelectSubtask: (index: number) => void
  onForkFromAction?: (action: MappedAction & { row: number }, ctx: ForkFromActionContext) => void
  onAnalyzeFromAction?: (action: MappedAction & { row: number }) => void
  listScrollRef?: RefObject<HTMLDivElement | null>
  sessionDirectory?: string
  /** Fork 后新 session：本地保存的 fork 前子任务面板可视化快照 */
  forkPanelSnapshotBundle?: ForkPanelSnapshotBundle | null
  /** ActionFlow rect 点击联动 */
  selection?: { subtaskIndex: number; actionKey: string } | null
  /** ActionFlow rect 单击 → action-level 选中 */
  onSelectAction?: (subtaskIndex: number, actionKey: string | null) => void
  /** 全局布局模式（由子任务面板头部统一切换） */
  flowLayoutMode?: 'timeline' | 'summary'
}

export default function SubtaskDebugPanel({
  messages,
  visibleSubtasks,
  linkedSubtaskIndex,
  onSelectSubtask,
  onForkFromAction,
  onAnalyzeFromAction,
  listScrollRef,
  sessionDirectory,
  forkPanelSnapshotBundle = null,
  selection = null,
  onSelectAction,
  flowLayoutMode = 'timeline',
}: SubtaskDebugPanelProps) {
  const [colorBy, setColorBy] = useState<'tokens' | 'type'>('type')
  const actionTypePaletteId: ActionTypePaletteId = DEFAULT_ACTION_TYPE_PALETTE_ID
  const [childSessionMessages, setChildSessionMessages] = useState<Record<string, OcMessage[]>>({})
  const summaryViewportRef = useRef<HTMLDivElement | null>(null)
  const [summaryViewportSize, setSummaryViewportSize] = useState({ width: 0, height: 0 })

  const summarySegments = useMemo(
    () =>
      visibleSubtasks.map(({ subtask, sourceIndex }, rowIndex) => {
        const indices = [...(subtask.userMessageIndices ?? []), ...subtask.assistantMessageIndices].sort(
          (a, b) => a - b,
        )
        const segmentMessages = indices
          .map((i) => messages[i])
          .filter((m): m is OcMessage => m != null)
        const parentActions = buildMappedActionsFromMessages(segmentMessages)
        const childDescriptors = collectTaskChildDescriptors(segmentMessages)
        return {
          sourceIndex,
          rowIndex,
          subtaskId: subtask.subtask_id,
          parentActions,
          childDescriptors,
        }
      }),
    [visibleSubtasks, messages],
  )

  useEffect(() => {
    if (flowLayoutMode !== 'summary') return
    const ids = Array.from(
      new Set(summarySegments.flatMap((seg) => seg.childDescriptors.map((d) => d.childSessionID))),
    )
    if (ids.length === 0) return
    let cancelled = false
    void (async () => {
      const entries = await Promise.all(
        ids.map(async (sid) => {
          try {
            const msgs = await getMessages(sid, `summary child session ${sid.slice(0, 8)}`, sessionDirectory)
            return [sid, msgs] as const
          } catch {
            return [sid, [] as OcMessage[]] as const
          }
        }),
      )
      if (cancelled) return
      setChildSessionMessages((prev) => {
        const next = { ...prev }
        for (const [sid, msgs] of entries) next[sid] = msgs
        return next
      })
    })()
    return () => {
      cancelled = true
    }
  }, [summarySegments, flowLayoutMode, sessionDirectory])

  useEffect(() => {
    if (flowLayoutMode !== 'summary') return
    const el = summaryViewportRef.current
    if (!el) return
    const update = () => {
      setSummaryViewportSize({ width: el.clientWidth, height: el.clientHeight })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [flowLayoutMode])

  const summaryRows = summarySegments.map(({ sourceIndex, rowIndex, subtaskId, parentActions, childDescriptors }) => {
    const childActions = childDescriptors.flatMap((desc) => {
      const msgs = childSessionMessages[desc.childSessionID] ?? []
      return buildMappedActionsFromMessages(msgs).map((a, i) => ({
        ...a,
        /** 锚定到 parent task 后面，保证同一子任务内时序可读 */
        sortTime: desc.anchorSortTime + 0.0005 + i * 0.0000001,
      }))
    })
    const actions = [...parentActions, ...childActions].sort((a, b) => a.sortTime - b.sortTime)
    return {
      sourceIndex,
      rowIndex,
      actions,
      subtaskId,
      sequenceSignature: actions.map((a) => a.actionType),
    }
  })
  /**
   * 分层分组排序（无标题）：
   * action1 相同聚在一起；组内再按 action2；再按 action3... 递归比较。
   */
  const summaryRowsSorted = [...summaryRows].sort((a, b) => {
    const n = Math.min(a.sequenceSignature.length, b.sequenceSignature.length)
    for (let i = 0; i < n; i++) {
      const cmp = a.sequenceSignature[i]!.localeCompare(b.sequenceSignature[i]!, 'en')
      if (cmp !== 0) return cmp
    }
    if (a.sequenceSignature.length !== b.sequenceSignature.length) {
      return a.sequenceSignature.length - b.sequenceSignature.length
    }
    return a.rowIndex - b.rowIndex
  })
  const summaryLayout = useMemo(() => {
    const DEFAULT_BLOCK_W = 28
    const DEFAULT_BLOCK_H = 36
    const ROW_LABEL_W = 28
    const rowCount = Math.max(1, summaryRowsSorted.length)
    const maxActionCount = Math.max(1, ...summaryRowsSorted.map((r) => r.actions.length))
    const availableW = Math.max(1, summaryViewportSize.width - ROW_LABEL_W)
    const availableH = Math.max(1, summaryViewportSize.height)
    const blockWidth = Math.max(2, Math.floor(Math.min(DEFAULT_BLOCK_W, availableW / maxActionCount)))
    const blockHeight = Math.max(2, Math.floor(Math.min(DEFAULT_BLOCK_H, availableH / rowCount)))
    return { blockWidth, blockHeight, rowLabelWidth: ROW_LABEL_W }
  }, [summaryRowsSorted, summaryViewportSize.width, summaryViewportSize.height])

  const summaryPanel = (
    <div
      ref={summaryViewportRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        padding: 0,
        border: 'none',
        borderRadius: 0,
        background: 'transparent',
      }}
    >
      {summaryRowsSorted.length === 0 ? (
        <span style={{ color: '#AAA', fontSize: 11 }}>暂无子任务</span>
      ) : (
        summaryRowsSorted.map((row) => {
          return (
            <div key={`${row.subtaskId}:${row.sourceIndex}:${row.rowIndex}`}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0,
                  margin: 0,
                  height: summaryLayout.blockHeight,
                }}
              >
                <span
                  style={{
                    width: summaryLayout.rowLabelWidth,
                    flexShrink: 0,
                    textAlign: 'right',
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#7A7A7A',
                    paddingRight: 0,
                  }}
                  title={`Subtask #${row.rowIndex + 1}`}
                >
                  #{row.rowIndex + 1}
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    height: summaryLayout.blockHeight,
                    padding: 0,
                  }}
                >
                  {row.actions.length === 0 ? (
                    <span style={{ color: '#B0B0B0', fontSize: 10 }}>No actions</span>
                  ) : (
                    row.actions.map((action) => {
                      const paletteTriad = getActionTypeTriad(actionTypePaletteId, action.actionType)
                      const tooltip = [
                        `Subtask #${row.rowIndex + 1}`,
                        `Step: ${(action.partIndex ?? 0) + 1}`,
                        `Type: ${action.actionType}`,
                        `Status: ${action.status}`,
                        `Duration: ${Math.max(0, Math.round(action.durationMs))}ms`,
                        `Tokens: ${Math.max(0, Math.round(action.tokenEstimate))}`,
                      ].join('\n')
                      return (
                        <span
                          key={actionKey(action)}
                          title={tooltip}
                          style={{
                            width: summaryLayout.blockWidth,
                            height: summaryLayout.blockHeight,
                            borderRadius: 0,
                            flexShrink: 0,
                            background: action.actionType === 'UserRequest' ? '#8F8F8F' : paletteTriad.fill,
                            border: 'none',
                          }}
                        />
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: '0 0 8px',
          borderBottom: '1px solid #E8E8E8',
          marginBottom: 8,
        }}
      >
        <ActionTypeColorLegend paletteId={actionTypePaletteId} />
      </div>
      <div
        ref={listScrollRef}
        style={{
          flex: 1,
          overflowY: flowLayoutMode === 'summary' ? 'hidden' : 'auto',
          fontSize: 11,
          color: '#333',
          lineHeight: 1.45,
        }}
      >
        {flowLayoutMode === 'summary' ? (
          summaryPanel
        ) : visibleSubtasks.length === 0 ? (
          <span style={{ color: '#AAA', fontSize: 11 }}>暂无子任务</span>
        ) : (
          visibleSubtasks.map(({ subtask: st, sourceIndex }, si) => (
            <Fragment
              key={`${st.subtask_id}:${sourceIndex}:${st.assistantMessageIndices[0] ?? -1}:${st.assistantMessageIndices[st.assistantMessageIndices.length - 1] ?? -1}:${st.assistantMessageIndices.length}`}
            >
            <SubtaskCard
              subtask={st}
              messages={messages}
              displayIndex={si}
              cardIndex={sourceIndex}
              isLinked={linkedSubtaskIndex === sourceIndex}
              onSelectSubtask={() => onSelectSubtask(sourceIndex)}
              onForkFromAction={onForkFromAction}
              onAnalyzeFromAction={onAnalyzeFromAction}
              sessionDirectory={sessionDirectory}
              forkPanelSnapshotBundle={forkPanelSnapshotBundle}
              selectedActionKey={
                selection && selection.subtaskIndex === sourceIndex ? selection.actionKey : null
              }
              otherSubtaskHasSelection={false}
              onSelectActionFromFlow={
                onSelectAction ? (key) => onSelectAction(sourceIndex, key) : undefined
              }
              colorBy={colorBy}
              onColorByChange={setColorBy}
              actionTypePaletteId={actionTypePaletteId}
            />
            </Fragment>
          ))
        )}
      </div>
    </div>
  )
}
