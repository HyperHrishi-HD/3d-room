import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  STATIONS,
  adjacentStation,
  parseStationHash,
  stationById,
  type Station,
} from '../data/stations'
import { markVisited } from '../lib/progress'

type SelectionSource = 'manual' | 'menu' | 'hash'

export interface FridgeScore {
  matches: number
  quiz: number
}

interface RoomStore {
  active: Station | null
  activeId: string | null
  /** How the station that just became active was chosen. */
  arrivalSource: SelectionSource | null
  destination: Station | null
  destinationId: string | null
  traveling: boolean
  overviewTravel: boolean
  menuOpen: boolean
  cinema: boolean
  fridgeScore: FridgeScore
  monitorRequest: { id: number; question: string } | null
  /** True when the canvas could not start. The shell offers a retry. */
  canvasFailed: boolean
  /** Bumped to remount the canvas without reloading the page. */
  canvasKey: number
  selectStation: (id: string, source?: SelectionSource) => void
  arrive: (id: string) => void
  arriveOverview: () => void
  closeStation: () => void
  stepStation: (direction: 1 | -1) => void
  setMenuOpen: (open: boolean) => void
  setCinema: (value: boolean) => void
  recordMatch: () => void
  recordQuiz: () => void
  resetFridgeScore: () => void
  askMonitor: (question: string) => void
  handleCanvasError: () => void
  retryCanvas: () => void
}

const RoomContext = createContext<RoomStore | null>(null)

export function RoomProvider({ children }: { children: ReactNode }) {
  const initialHash = window.location.hash
  const initialStation = useMemo(() => stationById(parseStationHash(initialHash)), [initialHash])
  const [destinationId, setDestinationIdState] = useState<string | null>(
    () => initialStation?.id ?? null,
  )
  const [activeId, setActiveIdState] = useState<string | null>(null)
  const [arrivalSource, setArrivalSource] = useState<SelectionSource | null>(null)
  const pendingSource = useRef<SelectionSource>('hash')
  const [menuOpen, setMenuOpenState] = useState(false)
  const [overviewTravel, setOverviewTravel] = useState(false)
  const [cinema, setCinemaState] = useState(false)
  const [fridgeScore, setFridgeScore] = useState<FridgeScore>({ matches: 0, quiz: 0 })
  const [monitorRequest, setMonitorRequest] = useState<{ id: number; question: string } | null>(null)
  const [canvasFailed, setCanvasFailed] = useState(false)
  const [canvasKey, setCanvasKey] = useState(0)

  const activeRef = useRef(activeId)
  const destinationRef = useRef(destinationId)
  const monitorCounter = useRef(0)

  const setActiveId = useCallback((id: string | null) => {
    activeRef.current = id
    setActiveIdState(id)
  }, [])

  const setDestinationId = useCallback((id: string | null) => {
    destinationRef.current = id
    setDestinationIdState(id)
  }, [])

  const updateHash = useCallback((id: string | null) => {
    // Keep the letters sheet's suffix when the TV writes its own station URL,
    // so opening #/station/tv/letters cannot bounce the dialog shut.
    const keepLetters =
      id === 'tv' && window.location.hash.replace(/\/+$/, '').endsWith('/letters')
    const next = id ? `#/station/${id}${keepLetters ? '/letters' : ''}` : '#/'
    if (window.location.hash === next) return
    window.history.pushState(null, '', next)
  }, [])

  const closeStation = useCallback(() => {
    setMenuOpenState(false)
    setActiveId(null)
    setDestinationId(null)
    setCinemaState(false)
    setOverviewTravel(true)
    updateHash(null)
  }, [setActiveId, setDestinationId, updateHash])

  const selectStation = useCallback(
    (id: string, source: SelectionSource = 'manual') => {
      const station = stationById(id)
      if (!station) return
      pendingSource.current = source
      setMenuOpenState(false)
      setCinemaState(false)
      setOverviewTravel(false)

      const currentActive = stationById(activeRef.current)
      if (currentActive?.kind === 'album' && station.kind === 'album') {
        setActiveId(station.id)
        setDestinationId(null)
        markVisited(station.n)
        updateHash(station.id)
        return
      }
      if (activeRef.current === station.id && destinationRef.current === null) {
        updateHash(station.id)
        return
      }
      if (destinationRef.current === station.id) return

      setActiveId(null)
      setDestinationId(station.id)
      updateHash(station.id)
    },
    [setActiveId, setDestinationId, updateHash],
  )

  const arrive = useCallback(
    (id: string) => {
      if (destinationRef.current !== id) return
      const station = stationById(id)
      if (!station) return
      setArrivalSource(pendingSource.current)
      setDestinationId(null)
      setActiveId(id)
      markVisited(station.n)
    },
    [setActiveId, setDestinationId],
  )

  const arriveOverview = useCallback(() => {
    setOverviewTravel(false)
  }, [])

  const stepStation = useCallback(
    (direction: 1 | -1) => {
      const current = stationById(activeRef.current ?? destinationRef.current)
      if (!current) return
      const target = adjacentStation(current, direction)
      if (target) selectStation(target.id, 'manual')
      else closeStation()
    },
    [closeStation, selectStation],
  )

  const setMenuOpen = useCallback((open: boolean) => {
    setMenuOpenState(open)
  }, [])

  const handleCanvasError = useCallback(() => {
    setCanvasFailed(true)
  }, [])

  /**
   * Re-arm the renderer in place. The shell keeps the room overview behind the
   * message, and a retry only remounts the canvas, never the page.
   */
  const retryCanvas = useCallback(() => {
    setCanvasFailed(false)
    setCanvasKey((key) => key + 1)
  }, [])

  const setCinema = useCallback((value: boolean) => {
    setCinemaState(value)
  }, [])

  const recordMatch = useCallback(() => {
    setFridgeScore((score) => ({ ...score, matches: score.matches + 1 }))
  }, [])

  const recordQuiz = useCallback(() => {
    setFridgeScore((score) => ({ ...score, quiz: score.quiz + 1 }))
  }, [])

  const resetFridgeScore = useCallback(() => {
    setFridgeScore({ matches: 0, quiz: 0 })
  }, [])

  const askMonitor = useCallback((question: string) => {
    const clean = question.trim()
    if (!clean) return
    monitorCounter.current += 1
    setMonitorRequest({ id: monitorCounter.current, question: clean })
  }, [])

  useEffect(() => {
    activeRef.current = activeId
  }, [activeId])

  useEffect(() => {
    destinationRef.current = destinationId
  }, [destinationId])

  useEffect(() => {
    const syncFromUrl = () => {
      const lettersLink = window.location.hash.endsWith('/letters')
      const id = parseStationHash(window.location.hash)
      if (!id) {
        setMenuOpenState(false)
        setActiveId(null)
        setDestinationId(null)
        setCinemaState(false)
        setOverviewTravel(true)
        return
      }
      if (destinationRef.current === id || activeRef.current === id) return
      selectStation(id, 'hash')
      // selectStation writes the plain station hash; keep the letter suffix
      // when the incoming link was the shareable letters URL.
      if (lettersLink && id === 'tv') {
        window.history.replaceState(null, '', `#/station/${id}/letters`)
      }
    }

    window.addEventListener('popstate', syncFromUrl)
    window.addEventListener('hashchange', syncFromUrl)
    return () => {
      window.removeEventListener('popstate', syncFromUrl)
      window.removeEventListener('hashchange', syncFromUrl)
    }
  }, [selectStation, setActiveId, setDestinationId])

  const active = useMemo(() => stationById(activeId) ?? null, [activeId])
  const destination = useMemo(() => stationById(destinationId) ?? null, [destinationId])
  const traveling = destinationId !== null

  const value = useMemo<RoomStore>(
    () => ({
      active,
      activeId,
      arrivalSource,
      destination,
      destinationId,
      traveling,
      overviewTravel,
      menuOpen,
      cinema,
      fridgeScore,
      monitorRequest,
      canvasFailed,
      canvasKey,
      selectStation,
      arrive,
      arriveOverview,
      closeStation,
      stepStation,
      setMenuOpen,
      setCinema,
      recordMatch,
      recordQuiz,
      resetFridgeScore,
      askMonitor,
      handleCanvasError,
      retryCanvas,
    }),
    [
      active,
      activeId,
      arrive,
      arrivalSource,
      arriveOverview,
      askMonitor,
      canvasFailed,
      canvasKey,
      cinema,
      closeStation,
      destination,
      destinationId,
      fridgeScore,
      handleCanvasError,
      menuOpen,
      monitorRequest,
      overviewTravel,
      recordMatch,
      recordQuiz,
      resetFridgeScore,
      retryCanvas,
      selectStation,
      setCinema,
      setMenuOpen,
      stepStation,
      traveling,
    ],
  )

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>
}

export function useRoom(): RoomStore {
  const store = useContext(RoomContext)
  if (!store) throw new Error('useRoom must be used inside RoomProvider')
  return store
}

export const ROOM_STATIONS = STATIONS
