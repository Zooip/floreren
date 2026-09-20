// Note: as of 2026-05-16, the new /calendar MonthView ships Dutch-only strings
// (matching the mockup at c:\Users\leon_\Downloads\Floreren Kalender.html).
// English translations are pending — see
// docs/plans/in-progress/2026-05-16-calendar-magazine-redesign.md section E4.
// The Phenology view (Agenda tab) and the rest of the app are already bilingual.

export type Translations = {
  locale: string

  nav: {
    plants: string
    maps: string
    calendar: string
    settings: string
    atlas: string
  }

  atlas: {
    mastheadTitle: string
    mastheadAccent: string
    lede: string
    filters: {
      cityLabel: string
      cityPlaceholder: string
      monthLabel: string
      monthAny: string
      scoreLabel: string
      scoreAny: string
      sortLabel: string
      sortScore: string
      sortName: string
      sortNewest: string
    }
    loading: string
    loadFailed: string
    retry: string
    emptyTitle: string
    emptyLede: string
    notFound: string
    backToAtlas: string
    card: {
      plantCount: (n: number) => string
      speciesCount: (n: number) => string
      scoreLabel: string
      flowerMonths: string
    }
    detail: {
      backLabel: string
      scoreLabel: string
      speciesLabel: string
      plantLabel: string
      floweringMonthsLabel: string
      plantsTitle: string
      noPlants: string
      noCity: string
      publicBadge: string
    }
  }

  dashboard: {
    greeting: {
      night: string
      morning: string
      afternoon: string
      evening: string
    }
    sections: {
      myGardens: string
      today: string
      logbook: string
      weather: string
      didYouKnow: string
      careSignals: string
    }
    actions: {
      done: string
      skip: string
      manage: string
      view: string
      edit: string
      newGarden: string
      addGarden: string
      fullLog: string
      mapTypeIndoor: string
      mapTypeOutdoor: string
    }
    status: {
      collection: string
      onSchedule: string
      thirsty: string
      dry: string
    }
    almanac: {
      sunrise: string
      sunset: string
      temp: string
      nextCare: string
      onTrack: string
    }
    tasks: {
      overdue: string
      dueToday: string
      upcoming: string
      today: string
      calm: string
      noTasks: string
      waterFeed: string
      attention: string
      daysLate: (n: number) => string
      inDays: (n: number) => string
    }
    weather: {
      title: string
      humidity: string
      soil: string
      light: string
      rain: string
      tonight: string
      loading: string
      unavailable: string
    }
    comingSoon: string
    warnings: {
      allOnSchedule: string
      signalCount: (n: number) => string
      plantCount: (n: number) => string
      bucketNow: string
      bucketToday: string
      bucketThisWeek: string
    }
  }

  care: {
    water: string
    fertilize: string
    mist: string
    rotate: string
    repot: string
    pest_check: string
    dust: string
    prune: string
    frost_protect: string
    heat_protect: string
  }

  careTypes: {
    water: string
    fertilize: string
    mist: string
    rotate: string
    repot: string
    pest_check: string
    dust: string
    prune: string
    frost_protect: string
    heat_protect: string
    photo: string
  }

  plants: {
    categories: Record<string, string>
    types: Record<string, string>
    forms: Record<string, string>
  }

  maps: {
    title: string
    newMap: string
    mapNameLabel: string
    mapNamePlaceholder: string
    loading: string
    loadingLede: string
    loadFailed: string
    retry: string
    failedCreate: string
    failedDelete: string
    indoor: string
    outdoor: string
    // Map card actions (were hardcoded English in the pre-i18n baseline)
    creating: string        // "Creating…"
    create: string          // "Create"
    view: string            // "View"
    svgImport: string       // "SVG import"
    deleteConfirmName: (name: string) => string  // "Delete \"{name}\"?"
    // PageMasthead keys (issue #180)
    mastheadEyebrow: string
    mastheadTitle: string
    mastheadAccent: string
    mastheadLede: string
    // Stat label for masthead
    mastheadStatLabel: string
    // Empty state when no maps exist
    noMaps: string
    createFirstMap: string
    createFirstLede: string
    // New-garden modal: starter layout + location (soft first-run)
    starterLabel: string          // "Beginnen met"
    starterTemplate: string       // "Voorbeeldopzet"
    starterTemplateHint: string   // "Borders, gazon en terras — pas alles later aan"
    starterEmpty: string          // "Leeg"
    starterEmptyHint: string      // "Zelf tekenen in de editor"
    locationLabel: string         // "Locatie (voor de zon)"
    locationUse: string           // "Gebruik mijn locatie"
    locationBusy: string          // "Locatie ophalen…"
    locationSet: string           // "Locatie ingesteld"
    locationError: string         // "Locatie ophalen mislukt — kan later in instellingen"
    locationSkipHint: string      // "Optioneel — kan ook later, in tuininstellingen"
    starterZoneFence: string      // "Schutting"
    starterZoneBackBorder: string // "Achterborder"
    starterZoneBorder: string     // "Border"
    starterZoneLawn: string       // "Gazon"
    starterZoneTerrace: string    // "Terras"
  }

  // ── Map settings page ───────────────────────────────────────────
  mapSettings: {
    pageTitle: string          // "Map settings"
    nameLabel: string          // "Name"
    namePlaceholder: string    // "Garden name..."
    typeLabel: string          // "Type"
    location: string           // "Location"
    latLabel: string           // "Latitude"
    lonLabel: string           // "Longitude"
    latPlaceholder: string     // "e.g. 52.3715"
    lonPlaceholder: string     // "e.g. 4.8499"
    useCurrentLocation: string // "Use current location"
    compassBearing: string     // "Compass bearing"
    compassHint: string        // "Point the needle..."
    dimensions: string         // "Dimensions"
    dimensionsHint: string     // "Edit dimensions via the layout editor"
    editLayout: string         // "Edit layout"
    dangerZone: string         // "Danger zone"
    deleteMap: string          // "Delete map"
    deleteConfirm: string      // "Are you sure?..."
    confirmDelete: string      // "Yes, delete"
    deleting: string           // "Deleting..."
    deleteFailed: string       // "Delete failed"
    backToMaps: string         // "Back to maps"
    locationUnavailable: string // "Location unavailable"
    saving: string             // "Saving..."
    saved: string              // "Saved"
    notFound: string           // "Map not found"
    outdoor: string            // "Garden"
    indoor: string             // "House"
    // PageMasthead keys (issue #180)
    mastheadTitle: string
    mastheadAccent: string
    // Public garden atlas opt-in (#804)
    publicSectionTitle: string
    publicToggleLabel: string
    publicToggleHint: string
    publicToggleDesc: string
    photosToggleLabel: string
    photosToggleHint: string
    outdoorOnlyHint: string
    // Dimension value (read-only display), was hardcoded Dutch in the baseline
    dimensionsValue: (w: string, h: string) => string  // "{w}m wide × {h}m deep"
  }

  editor: {
    /** Touch-only sheet for the element the user has selected. */
    selection: {
      deselect: string
      wallElement: string
      shadowCaster: string
    }
    zones: Record<string, { name: string; description: string }>
    toolbar: {
      select: string
      draw: string
      placeDoor: string
      placeWindow: string
      undo: string
      delete: string
      preview: string
      edit: string
      shadowCaster: string
      back: string
    }
    save: {
      saved: string
      saving: string
      unsaved: string
    }
    // Read-only block screen for viewer accounts (the editor is a write surface)
    readOnlyTitle: string     // "Layout editing is for editors"
    readOnlyBody: string      // "You can view this map, but only editors can change its layout."
    zoom: {
      in: string
      out: string
      fit: string
    }
    mapType: {
      garden: string
      house: string
      hint: string
      /** Confirm copy — the switch rewrites the zone vocabulary under existing shapes. */
      switchWarning: (zoneCount: number) => string
    }
    props: {
      type: string
      depthCm: string
      diameterCm: string
      /** Shown when a zone's stored type is outside ZoneStyleType. */
      unknownType: (type: string) => string
      labelPlaceholder: string
      soilNote: string
      soilNotePlaceholder: string
      material: string
      materialWood: string
      materialBrick: string
      bedHeightM: string
      /** Suffixes explaining what a height feeds into. */
      affectsShadow: string
      shadesLowerPlants: string
      infoOnly: string
      egHeight2: string
      egHeight25: string
      egHeight05: string
      egHeight26: string
      egLength: string
      egWidth: string
      cornerCutOpen: string
      cornerCutDone: (corner: string) => string
      cornerRestore: string
      corners: Record<'tl' | 'tr' | 'bl' | 'br', string>
      widthWithValue: (metres: string) => string
      depthWithValue: (metres: string) => string
      scaleReadout: (pxPerM: number, widthPx: number, heightPx: number) => string
      /** Wall edge names — the raw 'top'/'left' identifiers were shown as-is. */
      edges: Record<'top' | 'right' | 'bottom' | 'left', string>
      edgePosition: (edge: string, percent: number) => string
      zone: string
      door: string
      window: string
      label: string
      length: string
      width: string
      height: string
      widthCm: string
      hinge: string
      left: string
      right: string
      inward: string
      outward: string
      openingDirection: string
      wallThickness: string
      outerWall: string
      innerWall: string
      cornerCut: string
      corner: string
      scaleCalibrate: string
      scaleHint: string
      delete: string
      lightTree: string   // "Light tree" / "Lichte boom"
      rotation: string    // "Rotation" / "Rotatie"
      reset: string       // "Reset" / "Resetten"
      xM: string   // "X (m)"
      yM: string   // "Y (m)"
    }
    loading: string
    notFound: string
    viewMap: string
    sunPerimeterShow: string
    sunPerimeterHide: string
    more: string
    tourAction: string
    undoShortcut: string
    offCanvas: string
    shadowCasterList: (count: number) => string
    legend: string
    closeLegend: string
    legendLabels: Record<string, string>
    mode: string          // "Mode" / "Modus"
    legendZones: string   // "Zones" / "Zones"
    legendObjects: string // "Objects" / "Objecten"
    drawZones: string   // "Draw zones" / "Zones tekenen"
    legendShadows: string // "Shadows" / "Schaduwen"
    legendPlace: string   // "Place" / "Plaats"
    shadowObject: string  // "Shadow" / "Schaduw"  // { container: "Pot / Tray" / "Pot / Bak", hardscape: "Garden object" / "Tuinobject", utility: "Utility" / "Nutsvoorziening" }
    // Shadow caster properties panel
    shadowCasterBuilding: string   // "Gebouw" / "Building"
    shadowCasterBuildingDesc: string // "Teken een rechthoek" / "Draw a rectangle"
    shadowCasterTree: string       // "Boom" / "Tree"
    shadowCasterTreeDesc: string   // "Teken een cirkel" / "Draw a circle"
    fenceGarden: string            // "Omhein de tuin" / "Fence the garden"
    fenceGardenDesc: string        // "Zet automatisch hekken" / "Auto-place fences"
    fenceGardenBlocked: string     // "Teken eerst een zone" / "Draw a zone first"
    shadowCasterName: string       // "Naam" / "Name"
    rectPlaceholder: string        // "bijv. Buurman's huis" / "e.g. Neighbor's house"
    circlePlaceholder: string      // "bijv. Eik, Spar..." / "e.g. Oak, Pine..."
    shadowCasterPosition: string   // "Positie" / "Position"
    shadowCasterSide: string       // "Kant" / "Side"
    shadowCasterDistance: string   // "Afstand van tuin (m)" / "Distance from garden (m)"
    shadowCasterThickness: string   // "Dikte (m)" / "Thickness (m)"
    shadowCasterPosSize: string    // "Positie & grootte" / "Position & size"
    shadowCasterRadius: string     // "Straal (m)" / "Radius (m)"
    shadowDensity: string          // "Schaduwdichtheid" / "Shadow density"
    denseTree: string              // "Dichte boom" / "Dense tree"
    buildingWall: string           // "Gebouw / Muur" / "Building / Wall"
    top: string                    // "Boven" / "Top"
    bottom: string                 // "Onder" / "Bottom"
    tour: {
      skip: string
      next: string
      done: string
      goToSettings: string
      skipSettings: string
      outdoor: {
        step1: { title: string; body: string }
        // Steps that name a control need two wordings: the control is a
        // sidebar under a mouse and a button in the bottom dock under a
        // finger. `bodyTouch` is the phone copy, `body` the pointer copy.
        step2: { title: string; body: string; bodyTouch: string }
        step3: { title: string; body: string }
        step4: { title: string; body: string }
      }
      indoor: {
        step1: { title: string; body: string }
        step2: { title: string; body: string; bodyTouch: string }
        step3: { title: string; body: string; bodyTouch: string }
      }
    }
    wizard: {
      shapeTitle: string
      shapeSubtitle: string
      shapeRectangle: string
      shapeRectangleHint: string
      shapeLshape: string
      shapeLshapeHint: string
      shapeBalcony: string
      shapeBalconyHint: string
      shapeCustom: string
      shapeCustomHint: string
      // Indoor variants (#841 F1)
      shapeTitleIndoor: string
      shapeSubtitleIndoor: string
      sizeTitleIndoor: string
      shapeStudio: string
      shapeStudioHint: string
      shapeTwoRoom: string
      shapeTwoRoomHint: string
      shapeLroom: string
      shapeLroomHint: string
      shapeCustomIndoorHint: string
      sizeTitle: string
      sizeSubtitle: string
      widthLabel: string
      depthLabel: string
      orientationTitle: string
      orientationSubtitle: string
      locationTitle: string
      locationSubtitle: string
      useMyLocation: string
      locating: string
      locationSet: string
      locationError: string
      skip: string
      back: string
      next: string
      finish: string
      /** "Stap 2 van 4" — the flow's length is otherwise unknowable from inside it. */
      stepOf: (current: number, total: number) => string
      /** Leaves the wizard for a blank canvas. Step 1 had no exit at all. */
      close: string
    }
    background: {
      title: string
      add: string
      uploading: string
      hint: string
      opacity: string
      locked: string
      unlocked: string
      widthM: string
      calibrateHint: string
      remove: string
    }
  }

  photoJournal: {
    addPhoto: string
    uploading: string
    empty: string
    deleteConfirm: string
    delete: string
    older: string
    newer: string
    compare: string
    compareOff: string
    reminderLabel: string
    reminderHint: string
    daysSuffix: string
    addCarePhoto: string
    careBadgeHint: string
    mismatchHint: string
  }

  photoRound: {
    title: string
    lede: string
    readOnlyTitle: string   // "The photo round is for editors"
    readOnlyBody: string    // "It photographs every plant, which only editors can do."
    scopeAll: string
    scopeLabel: string
    loading: string
    progress: (done: number, total: number) => string
    neverPhotographed: string
    lastPhoto: (days: number) => string
    noSpeciesWarning: string
    takePhoto: string
    uploading: string
    skip: string
    finish: string
    doneTitle: string
    doneBody: (count: number) => string
    doneNothing: string
    empty: string
    uploadFailed: string
    loadFailed: string
    retry: string
    startFromPlants: string
  }

  settings: {
    title: string
    mastheadEyebrow: string
    mastheadTitle: string
    mastheadAccent: string
    mastheadLede: string
    display: string
    carePlanning: string
    carePlanningTitle: string
    carePlanningDescription: string
    calendarGroupingShared: string
    calendarGroupingIndoor: string
    calendarGroupingOutdoor: string
    calendarGroupingQuickSetup: string
    calendarGroupingRecommended: string
    calendarGroupingAllRecurring: string
    calendarGroupingClear: string
    calendarGroupingCopyIndoor: string
    calendarGroupingCopyOutdoor: string
    calendarGroupingRecurring: string
    calendarGroupingNone: string
    calendarGroupingNoMaps: string
    calendarGroupingSaveError: string
    calendarSubscriptionTitle: string
    calendarSubscriptionDescription: string
    calendarSubscriptionRecommended: string
    calendarSubscriptionSecurity: string
    calendarSubscriptionEnvironment: string
    calendarSubscriptionEnvironmentAll: string
    calendarSubscriptionEnvironmentOutdoor: string
    calendarSubscriptionEnvironmentIndoor: string
    calendarSubscriptionSpaces: string
    calendarSubscriptionAllSpaces: string
    calendarSubscriptionCareTypes: string
    calendarSubscriptionAllCareTypes: string
    calendarSubscriptionContext: string
    calendarSubscriptionContextDescription: string
    calendarSubscriptionPrivacy: string
    calendarSubscriptionPrivacyDescription: string
    calendarSubscriptionExampleLabel: string
    calendarSubscriptionUsefulExample: string
    calendarSubscriptionPrivateExample: string
    calendarSubscriptionCreate: string
    calendarSubscriptionRegenerate: string
    calendarSubscriptionRegenerateWarning: string
    calendarSubscriptionRegenerateConfirm: string
    calendarSubscriptionManageLink: string
    calendarSubscriptionCreating: string
    calendarSubscriptionSave: string
    calendarSubscriptionActive: string
    calendarSubscriptionSaveNow: string
    calendarSubscriptionCopy: string
    calendarSubscriptionCopied: string
    calendarSubscriptionRevoke: string
    calendarSubscriptionDownload: string
    calendarSubscriptionDownloadDescription: string
    calendarSubscriptionGoogle: string
    calendarSubscriptionOutlook: string
    calendarSubscriptionApple: string
    calendarSubscriptionProviderHint: string
    calendarSubscriptionRefreshHint: string
    calendarSubscriptionLoadError: string
    calendarSubscriptionActionError: string
    careRhythmTitle: string
    careRhythmDescription: string
    careRhythmProposed: string
    careRhythmSaved: string
    careRhythmOrganize: string
    careRhythmChange: string
    careRhythmSafety: string
    careRhythmIndoorDays: string
    careRhythmOutdoorDays: string
    careRhythmPreferredDays: string
    careRhythmNoPreferredDays: string
    careRhythmInherit: string
    careRhythmOverride: string
    careRhythmWeekdays: [string, string, string, string, string, string, string]
    careRhythmPreviewTitle: string
    careRhythmPreviewTiming: (canonicalDate: string, sessionDate: string) => string
    careRhythmMovedCount: (count: number) => string
    careRhythmUnchangedCount: (count: number) => string
    careRhythmExceptionCount: (count: number) => string
    careRhythmGroupCount: (count: number) => string
    careRhythmApply: string
    careRhythmApplying: string
    careRhythmUndo: string
    careRhythmUndoing: string
    careRhythmApplied: string
    careRhythmNoSchedules: string
    careRhythmLoadError: string
    careRhythmPreviewError: string
    careRhythmApplyError: string
    careRhythmStaleError: string
    careRhythmUndoConflict: string
    careRhythmClose: string
    careRhythmReasonMoved: string
    careRhythmReasonAligned: string
    careRhythmReasonOutside: string
    careRhythmReasonOptedOut: string
    careRhythmReasonNotFuture: string
    careRhythmReasonNoRoutine: string
    careRhythmReasonRoutineProjected: string
    careRhythmReasonRoutineAligned: string
    careRhythmReasonTooFrequent: string
    digestTitle: string
    digestToggle: string
    digestToggleDesc: string
    digestTimeLabel: string
    digestTimeDesc: string
    quietHoursLabel: string
    quietHoursDesc: string
    mutedTypesLabel: string
    mutedTypesDesc: string
    digestLoadError: string
    digestSaveError: string
    pushToggle: string
    pushToggleDesc: string
    pushDenied: string
    pushUnsupported: string
    pushIosHint: string
    pushIosReinstallHint: string
    pushTestButton: string
    pushTestSending: string
    pushTestOk: string
    pushTestNoSub: string
    pushTestVapid: string
    pushTestGone: string
    pushTestFailed: string
    dataSectionTitle: string
    dataTitle: string
    dataDescription: string
    downloadData: string
    downloadCareLogCsv: string
    downloading: string
    downloadReady: string
    downloadError: string
    householdTitle: string
    householdName: string
    householdNamePlaceholder: string
    householdSaved: string
    memberEmail: string
    memberJoined: string
    whoIsGardening: string
    active: string
    locations: string
    addLocation: string
    locationNamePlaceholder: string
    editLocation: string
    deleteLocation: string
    save: string
    cancel: string
    confirmDeleteLocation: string
    locationHasPlants: string
    moveUp: string
    moveDown: string
    rename: string
    language: string
    languageNl: string
    languageEn: string
    // ── Group headings (2026-08 settings restructure) ──
    groupYou: string
    groupYouDesc: string
    groupHousehold: string
    groupHouseholdDesc: string
    groupCare: string
    groupCareDesc: string
    groupCareSummary: string
    groupNotifications: string
    groupNotificationsDesc: string
    groupPlaces: string
    groupPlacesDesc: string
    groupApp: string
    groupAppDesc: string
    groupAdmin: string
    groupAdminDesc: string
    adminBadge: string
    adminPanel: string
    // Collapsed-group summaries
    memberCountOne: string
    memberCountMany: string
    locationCountOne: string
    locationCountMany: string
    digestOnAt: string
    digestOff: string
    pushOn: string
    pushOff: string
    // Newly translated (were hardcoded)
    profileLoadError: string
    profileSaveError: string
    membersLoadError: string
    householdRenameError: string
    inviteError: string
    nameTakenError: string
    logoutConfirm: string
    you: string
    editMember: string
    editMemberTitle: string
    removeMemberNamed: string
    removeConfirmNamed: string
    renameNamed: string
    deleteLocationNamed: string
    confirmDeleteLocationNamed: string
    locationIcon: string
    locationsDescription: string
    noLocations: string
    assistantDescription: string
    themeDeviceHint: string
    quietHoursStart: string
    quietHoursEnd: string
    profile: string
    profileName: string
    profileAvatar: string
    profileEmail: string
    profileSaved: string
    changePassword: string
    currentPassword: string
    newPassword: string
    passwordMinLength: string
    passwordError: string
    passwordChanged: string
    icons: {
      title: string
      noChanges: string
      stillMissing: string
      description: string
      syncButton: string
      syncing: string
      result: string
      linked: string
      linkedCount: string
      stillMissingCount: string
      noIconFor: string
      setManually: string
      upToDate: string
      gapsTitle: string
      gapsDescription: string
      loadGaps: string
      loadingGaps: string
    }
    removeConfirm: string // "Weet je zeker dat je" / "Are you sure you want to remove"
    removeError: string   // "Fout bij verwijderen" / "Error removing member"
    removeMember: string  // "Verwijderen" / "Remove"
    inviteTitle: string       // "Nodig iemand uit" / "Invite someone"
    inviteDescription: string // "Genereer een code..." / "Generate a code..."
    generateCode: string      // "Genereer uitnodigingscode" / "Generate invite code"
    generatingCode: string    // "Code genereren..." / "Generating code..."
    shareCode: string         // "Deel deze code..." / "Share this code..."
    newCode: string           // "Nieuwe code genereren" / "Generate new code"
    copyCode: string          // "Kopieer code" / "Copy code"
    assistantTitle: string    // "Assistent" / "Assistant"
    resetAssistant: string    // "Stekkie resetten" / "Reset Stekkie"
    resetAssistantDone: string // "Stekkie is gereset!" / "Stekkie has been reset!"
    about: string
    themeLabel: string
    themeLight: string
    themeDark: string
    themeSystem: string
    logout: string
    // ── Read-only viewer mode (2026-08 capability gating) ──
    readOnlyBanner: string        // "Read-only · You can look, but only editors can change this."
    onlyEditorsCanChange: string  // "Only editors can change this."
    editorOnlyPage: string        // "This is an editing page. Ask an editor to do this."
    roleOwner: string             // "Owner"
    roleEditor: string            // "Editor"
    roleViewer: string            // "Viewer"
    memberRoleLabel: string       // "Role" — aria label for the role picker
    rolePickerLabel: string       // "Change role" — owner-only member role control
    inviteRoleLabel: string       // "Invite as" — owner-only invite-role choice
    roleChangeError: string       // "Fout bij rol wijzigen" / "Error changing role"
  }

  // ── Sun / heatmap controls ──────────────────────────────────────
  sun: {
    live: string
    heatmap: string
    now: string
    sunHoursIn: string  // "~{hours}h sunshine in {month}" — altitude-weighted equivalent hours (#855)
    whatCanGrow: string  // "What can go here? →"
    aboveHorizon: string  // "{deg}° above horizon"
    belowHorizon: string  // "Below horizon"
    calculating: string  // "Calculating..."
    estimatePlantShade: string  // "Estimate plant shade" toggle (#648)
    // Bucket labels (light quality heatmap)
    bucketFull: string
    bucketPart: string
    bucketBrightShade: string
    bucketDeepShade: string
    // Heatmap layer toggle
    layerSunHours: string
    layerSkyOpenness: string
    layerLightQuality: string
    // Sun category labels for GrowHereSheet
    sunCategoryFull: string    // "Full sun" / "Volle zon"
    sunCategoryPartial: string // "Partial sun" / "Half zon"
    sunCategoryShade: string   // "Shade" / "Schaduw"
  }

  // ── Grow-here sheet ─────────────────────────────────────────────
  growHere: {
    title: string  // "What can grow here?"
    sunLabel: string  // "~{hours}h sunshine" — altitude-weighted equivalent hours (#855)
    alreadyInGarden: string  // "Already in your garden"
    suggestions: string  // "Suggestions"
    aiSuggestions: string  // "AI Suggestions"
    add: string  // "+ Add"
    addLoading: string  // "..."
    aiError: string  // "Could not load AI suggestions."
    badgePerfect: string
    badgeAcceptable: string
    badgeGood: string
    hoursPerDay: string  // "{hours}h / day" / "{hours}u / dag"
    dbSuggestions: string        // "Passende planten"
    ecologyNative: string        // "🇳🇱 Inheems"
    ecologyPollinatorHigh: string // "🐝 Top bestuiver"
    ecologyPollinatorGood: string // "🐝 Goed voor bijen"
    ecologyFillsGap: string      // "Vult: {months}"
    ecologyStreek: string        // "Streekeigen" / "Regional"
    ecologyForageGap: string     // "🐝 Vult drachtgat" / "🐝 Fills bee gap"
    ecologyMoth: string          // "🌙 Nachtvlinder" / "🌙 Moth plant"
    ecologyMothGap: string       // "🌙 Trekt nachtvlinders" / "🌙 Attracts moths"
    sizeLargeForSpace: string    // "🌳 Grote plant" / "🌳 Large — needs space"
    altPrefix: string            // "Geen ruimte?" / "No room?"
    sunFitPerfect: string        // "Ideaal licht"
    sunFitAcceptable: string     // "Geschikt licht"
    sunFitMarginal: string       // "Krap licht"
    sunFitTolerated: string      // "Verdraagt dit licht"
    noDbResults: string          // "Weinig data beschikbaar"
  }

  // ── Icon picker ─────────────────────────────────────────────────
  iconPicker: {
    title: string   // "Choose icon" / "Kies icoon"
    searchPlaceholder: string  // "Search icons..." / "Zoek iconen..."
    clear: string   // "Clear" / "Wissen"
    noResults: string  // "No icons found" / "Geen iconen gevonden"
  }

  // ── Spot Inspector sheet ────────────────────────────────────────
  spotInspector: {
    title: string  // "Spot inspection"
    loading: string  // "Loading..."
    suitable: string  // "Suitable"
    marginal: string  // "Marginal"
    noPlantsFound: string  // "No suitable plants found for this spot."
    sow: string  // "Sow:"
    plant: string  // "Plant:"
    harvest: string  // "Harvest:"
    frostSensitive: string  // "Frost-sensitive"
    deficitPerDay: string  // "~{hours}h/day deficit in growing season"
    sunPerMonth: string  // "Sun per month at this spot"
    bioNative: string  // "Native"
    bioStreek: string  // "Regional"
    bioBeeForage: string  // "Bee forage"
    bioMoth: string  // "Moth"
  }

  // ── Phenology / Agenda ──────────────────────────────────────────
  phenology: {
    title: string            // "Agenda" / "Agenda"
    actionRequired: (n: number) => string  // "{n} need(s) action" / "{n} vraagt om actie"
    growingActive: (n: number) => string   // "{n} growing actively" / "{n} groeit actief"
    dormant: (n: number) => string         // "{n} dormant" / "{n} in rust"
    noPlants: string         // "No plants with a care schedule" / "Geen planten met een verzorgingsschema"
    noData: string           // "No phenology data" / "Geen fenologie data"
    labelUnavailable: string // "Label unavailable" / "Label niet beschikbaar"
    badgeSow: string
    badgeTransplant: string  // "Transplant" / "Verplanten"
    badgeHarvest: string     // "Harvest" / "Oogsten"
  }

  // ── Plant Quick Sheet ───────────────────────────────────────────
  plantQuickSheet: {
    close: string
    moreInfo: string
    quantityCount: (n: number) => string  // "6 stuks" / "6 plants"
    spotsHeading: string                  // "Extra plekken" / "Other spots"
    spotLabel: (n: number) => string      // "Plek 2" / "Spot 2"
    spotSameAge: string                   // "— zelfde leeftijd —" / "— same age —"
    addSpot: string                       // "Voeg nog een plek toe" / "Add another spot"
    removeSpot: string                    // "Plek verwijderen" / "Remove spot"
    tasksDue: (n: number) => string       // "4 taken te doen" / "4 tasks due"
    photo: string                         // "Foto" / "Photo"
    addPhoto: string                      // aria — "Voortgangsfoto toevoegen" / "Add progress photo"
    menu: string                          // aria — "Meer acties" / "More actions"
    copy: string  // "Copy plant"
    duplicate: string
    edit: string  // "Edit plant"
    lock: string
    unlock: string
    remove: string
    delete: string  // "Delete plant"
    fixed: string  // "Fixed — cannot be moved"
    careWater: string
    careFertilize: string
    carePrune: string
    careRepot: string
    careMist: string
    careRotate: string
    carePestCheck: string
    nextCare: (label: string, days: number) => string
    noRhythm: string
    careDust: string
    careProtectCold: string
    careProtectHeat: string
    undo: string                        // chip label when a care action was logged — "Ongedaan" / "Undo"
    undoHint: (action: string) => string  // aria/title — "Maak {action} ongedaan" / "Undo {action}"
    overdue: (n: number) => string
    today: string
    overN: (n: number) => string
    removeFrom: string
    plantedIn: string
    move: string
    moveOnMap: string
    moveToMap: string
    thisSpot: string
    goodFit: string
    partialFit: string
    insufficientFit: string
    sunHoursUnit: string
    sunSourceMeasured: string
    sunSourceEstimated: string
    sunMeasureOpen: string
    sunMeasureTitle: string
    sunMeasureHint: string
    sunMeasureClear: string
    sunMeasureLess: string
    sunMeasureMore: string
    sunMeasureSave: string
    water: string
    fertilize: string
    editPlant: string
  }

  // ── Move-plant sheet ─────────────────────────────────────────
  movePlantSheet: {
    title: string          // "Move to another map"
    currentMap: string     // "Current map: {name}"
    error: string          // "Moving failed. Try again."
    loading: string        // "Loading…"
    noOtherMaps: string    // "No other maps available."
    typeIndoor: string     // "Indoor"
    typeOutdoor: string    // "Outdoor"
  }

  // ── Plant picker sheet ──────────────────────────────────────────
  plantPicker: {
    close: string
    title: string
    subtitle: string
    searchPlaceholder: string
    addCustom: (name: string) => string
    typeName: string
    notInList: string
    noResults: string
    addAsNew: (name: string) => string
  }

  // ── Plant Detail page ──────────────────────────────────────────
  plantDetail: {
    mastheadEyebrow: string   // desktop masthead eyebrow, e.g. "Plant passport"
    statSchedules: string     // masthead stat label: nr of care schedules
    statSunHours: string      // masthead stat label: sun hours per day
    signalsHeading: string  // section header above warnings + this month's actions
    copyPlant: string
    yearCalendar: string
    care: string
    overdue: string
    today: string
    xDays: string  // "Every {n} days"
    intervalSourceSpecies: string
    intervalSourceProvisional: string
    byPerson: string  // "by {name}"
    deleteSchedule: string
    markDone: string  // row action: log this care as done today
    lastDoneToday: string
    lastDoneYesterday: string
    lastDoneDaysAgo: (n: number) => string
    addCare: string          // "Add care"
    addCareType: string
    addCarePick: string      // empty-select placeholder
    addCareInterval: string
    manageCare: string
    editInterval: string
    addCareFailed: string
    deleteScheduleConfirm: string
    undo: string
    photoJournal: string
    careHistory: string
    skipped: string  // "skipped:"
    did: string  // "did:"
    archivePlant: string
    deleteConfirm: string
    edit: string  // "Edit"
    whatCanYouDo: string  // "What can you do now?"
    sunHoursLabel: string  // "Sun hours:"
    sunHoursUnit: string  // "h/day" / "u/dag"
    speciesProfile: string // desktop passport: species care profile section header
    gardenWeather: string  // desktop passport: garden weather section header
    fitGood: string  // "✓ Good fit"
    fitPartial: string  // "~ Partial"
    fitInsufficient: string  // "⚠ Insufficient"
    prevPlant: string  // "Previous plant" tooltip
    nextPlant: string  // "Next plant" tooltip
  }

  ecology: {
    title: string
    /** Title once the species profile rows moved in — it is no longer only ecology. */
    aboutSpecies: string
    native: string
    nonNative: string
    invasive: string
    pollinatorTopTier: string
    pollinatorGood: string
    pollinatorMinor: string
    pollinatorNone: string
    floweringPrefix: string
    hostPrefix: string
    scoreLabel: string
    sourceLabel: string
    sourceLlmWarning: string
    enrichedAt: string
    failed: string
    loading: string
  }

  phaseCalendar: {
    now: (month: string) => string   // "Now (Aug): " / "Nu (aug): "
    sow: string
    transplant: string
    harvest: string
  }

  // ── Garden weather (map popover + passport summary) ────────────
  gardenWeather: {
    rainfallTitle: string     // "Rainfall — 14 days"
    temperatureTitle: string  // "Temperature — 7 days"
    total: string             // "Total:"
    avgMax: string            // "Avg max:"
    rainSummary: (mm: number) => string   // "22 mm in 14 days"
    tempSummary: (c: number) => string    // "21°C avg max"
    historyHeading: string    // weather popover section header
    /** API assessment values: hot | warm | mild | cool | cold */
    tempBadges: Record<string, string>
    /** API assessment values: well_watered | moderate | dry | very_dry */
    rainBadges: Record<string, string>
  }

  // ── PlantCareInfo card (species profile) ───────────────────────
  careInfo: {
    /**
     * Evidence under the water warning in "Aandacht nodig" — the plant-specific
     * version of the claim the warning makes. Lowercase fragments: they are
     * joined with separators, not read as sentences.
     */
    waterLastGiven: (days: number) => string
    waterNeverGiven: string
    waterRainSince: (mm: number) => string
    waterOverdue: (days: number) => string
    more: string
    less: string
    loadFailed: string
    noSpeciesInfo: string
    mmPerYear: string
    evergreen: string
    deciduous: string
    flowersLabel: string   // "Flowers:" / "Bloemen:"
    avgHeight: string      // "Average height:"
    toxicityUnknown: (raw: string) => string  // fallback for an unmapped API value
    edible: string         // "Edible"
    /** API toxicity values: low | medium | high → a full phrase */
    toxicityLevels: Record<string, string>
    /** API flower_colors values (English words) → localized colour names */
    flowerColors: Record<string, string>
    /** API light_label values: shade | partial | full_sun */
    lightLabels: Record<string, string>
    /** API duration values: perennial | annual | biennial */
    durations: Record<string, string>
  }

  // ── Add / Edit Plant ────────────────────────────────────────────
  addPlant: {
    title: string  // "Add plant 🌱"
    preview: string
    // Read-only block for viewer accounts (the add form is a pure write surface)
    readOnlyTitle: string     // "Adding plants is for editors"
    readOnlyBody: string      // "You can browse the collection, but only editors can add plants."
    entry: {
      identify: string         // "Identify with photo"
      identifySubtitle: string // "Fastest — let AI recognise the species"
      pick: string             // "Pick from list"
      pickSubtitle: string     // "Browse our plant library"
      manual: string           // "Enter manually"
      manualSubtitle: string   // "I know what it is"
      recommended: string      // badge on the photo-ID route
      speciesBadge: (n: number) => string  // badge on the pick route
    }
    // Entry-screen masthead: "<entryTitle> <entryAccent>." (accent is italic)
    entryTitle: string
    entryAccent: string
    // ── Form header ──
    breadcrumb: string      // "Collection" / "Collectie"
    heading: string         // "Add" / "Toevoegen"
    subheading: string      // "Fit a new plant into its best spot."
    basic: string           // "BASIC"
    details: string         // "DETAILS"
    // ── § I · Identity ──
    secIdentity: string     // "§ I · Identity"
    secIdentityTitle: string // "Give her a name."
    labelNickname: string   // "Nickname"
    labelNicknameDesc: string
    labelSpecies: string
    labelSpeciesDesc: string
    labelForm: string
    labelFormDesc: string
    labelPhase: string
    labelPhaseDesc: string
    labelQuantity: string
    labelQuantityDesc: string
    labelAcquired: string
    labelAcquiredDesc: string
    placeholderNickname: string
    placeholderSpecies: string
    placeholderSpeciesLatin: string
    placeholderAcquiredAt: string
    // ── § II · Placement ──
    secPlacement: string
    secPlacementTitle: string
    secPlacementSubtitle: string
    labelZone: string
    labelZoneDesc: string
    labelLight: string
    labelLightDesc: string
    labelPot: string
    labelPotDesc: string
    labelPotDiameter: string
    labelPotHeight: string
    labelDrainage: string
    labelDrainageYes: string
    labelSubstrate: string
    labelSubstrateDesc: string
    substrateHelp: string
    // Light tiles
    // One per SUN_REQUIREMENT_IDS — the Light row offers exactly these three.
    lightShade: string
    lightShadeSub: string
    lightPartial: string
    lightPartialSub: string
    lightFullSun: string
    lightFullSunSub: string
    // Pot material tiles
    potTerracotta: string
    potTerracottaSub: string
    potPlastic: string
    potPlasticSub: string
    potCeramic: string
    potCeramicSub: string
    potBasket: string
    potBasketSub: string
    // ── § III · Care ──
    secCare: string
    secCareTitle: string
    secCareSubtitle: string
    labelWatering: string
    labelWateringDesc: string
    waterAdviceSubtitle: string
    waterAdviceSpecies: (days: number) => string
    waterAdviceProvisional: (days: number) => string
    waterAdviceEditable: string
    optionalCareAfterCreate: string
    careRhythmJoin: string
    careRhythmProposal: (date: string) => string
    careRhythmAccept: string
    labelVolume: string
    labelVolumeDesc: string
    volumeUnit: string
    labelFeeding: string
    labelFeedingDesc: string
    labelPruneType: string
    labelPruneTypeDesc: string
    labelPruneFreq: string
    labelPruneFreqDesc: string
    // Watering presets
    presetSeldom: string
    presetWeekly: string
    presetBiweekly: string
    presetDaily: string
    // Feeding tiles
    feedWeekly: string
    feedWeeklySub: string
    feedMonthly: string
    feedMonthlySub: string
    feedSeasonal: string
    feedSeasonalSub: string
    feedOptional: string
    feedOptionalSub: string
    // Pruning type tiles
    pruneNone: string
    pruneNoneSub: string
    pruneLight: string
    pruneLightSub: string
    pruneModerate: string
    pruneModerateSub: string
    pruneHeavy: string
    pruneHeavySub: string
    // Pruning frequency tiles
    pruneNever: string
    pruneNeverSub: string
    pruneW: string       // "Weekly"
    pruneWSub: string
    pruneM: string       // "Monthly"
    pruneMSub: string
    pruneS: string       // "Seasonal"
    pruneSSub: string
    // ── § IV · Album ──
    secAlbum: string
    secAlbumTitle: string
    secAlbumSubtitle: string
    labelIcon: string
    labelIconDesc: string
    labelSown: string
    labelSownDesc: string
    labelNotes: string
    labelNotesDesc: string
    // ── Form options ──
    formPot: string
    formPotSub: string
    formGround: string
    formGroundSub: string
    formSeedling: string
    formSeedlingSub: string
    formTree: string
    formTreeSub: string
    // ── Phase labels ──
    phaseSeed: string
    phaseSprout: string
    phaseSeedling: string
    phaseYoung: string
    phaseEstablished: string
    // ── Zone picker ──
    zonePlants: (n: number) => string
    zoneEmpty: string       // shown when the account has no maps yet
    labelPlace: string      // placement picker field label
    labelPlaceDesc: string  // placement picker field description
    // ── Placement picker (tap-to-place on the selected map) ──
    placePickerHint: string   // "Tap the spot on the map where the plant should go"
    placePickerSet: string    // "Tap again to move the marker"
    placePickerUnavailable: string // shown when the map has no usable viewbox
    /**
     * Placement advice, keyed by the light level we actually know for the
     * plant. Previously one fixed "prefers a bright spot without direct
     * sunlight" line was shown for every species, full-sun plants included.
     */
    zoneAdvice: {
      shade: (subject: string) => string
      indirect: (subject: string) => string
      fullSun: (subject: string) => string
    }
    // ── Entry banner ──
    banner: {
      tabDatabase: string
      tabPhoto: string
      dbSubtitle: string
      dbSubtitleCount: (count: string) => string
      photoSubtitle: string
      selected: string
      changeSpecies: string
      pickSpecies: string
      browsePrompt: string
      browseCount: (count: string) => string
      uploadPhoto: string
      uploadPhotoPrompt: string
      photoAlt: string
      photoLabel: string
      match: string
      confidence: string
      database: string
      speciesCount: (count: string) => string
      imageRefs: string
      alternatives: string
    }
    // ── Submit errors ──
    errorInvalid: string
    errorAuth: string
    errorServer: string
    errorNetwork: string
    // ── Species prefill caption ──
    speciesFromPrefill: (latin: string) => string
    // ── Substrate options ──
    substrateOptions: string[]
    // ── Action bar ──
    cancel: string
    submitting: string
    adding: string           // "Adding plant..." / "Plant aanmaken..."
    fetchingSpecies: string  // "Loading species data..." / "Soortgegevens ophalen..."
    calculatingCare: string  // "Calculating care advice..." / "Verzorgingsadvies berekenen..."
    stillWorking: (n: number) => string  // "Working... (12s)" / "Bezig... (12s)"
  }

  // ── Plant identification flow ───────────────────────────────────
  identify: {
    readOnlyTitle: string  // "Identifying is for editors"
    readOnlyBody: string   // "You can browse the guide, but only editors can identify plants."
    camera: {
      title: string     // "Take a photo"
      capture: string   // "Capture"
      cancel: string    // "Cancel"
      noAccess: string  // "No camera access"
      hint: string      // "Photograph a leaf or flower close-up, in good light"
      hintDismiss: string // "Dismiss tip"
      retakeTipNoMatch: string        // "Move closer — fill the frame with a single leaf or flower"
      retakeTipLowConfidence: string  // "Avoid harsh shadows; find even light"
    }
    multiAngle: {
      addAngle: string   // "Add another angle"
      hint: string       // "Two or three angles give a more reliable match."
      identify: string   // "Identify with {count} photos"
      identifyOne: string // "Identify with this photo"
    }
    identifying: string  // "Identifying..."
    newPhoto: string     // "📷 Take new photo"
    enriching: string    // title for the loading state after selecting an ID candidate
    enrichingLede: string // explanatory copy for the same loading state
    results: {
      title: string       // "Possible matches"
      sheetTitle: string  // "Determination" — Fraunces heading on the results sheet
      confidence: string  // "confidence"
      poweredBy: string   // "powered by Pl@ntNet"
      choose: string      // "Pick this one"
      sourceBioclip: string  // "Floreren suggestion"
      sourcePlantnet: string // "PlantNet second opinion"
      bestMatch: string      // "Best match"
      alternativeMatch: string // "Could also be"
      noneOfThese: string    // "None of these? Enter manually"
      plantnetCta: string          // "PlantNet second opinion"
      plantnetProminentCta: string // "Ask PlantNet for a second opinion"
    }
    destination: {
      title: string
      subtitle: string
      journalTitle: string
      journalSubtitle: string
      gardenTitle: string
      gardenSubtitle: string
      backToMatches: string
    }
    lowConfidence: string  // DEPRECATED, kept until confidence.low rollout completes
    plantnetConfirm: string  // confirm dialog text shown when user clicks the PlantNet fallback button
    confidence: {
      medium: string       // "Fairly confident" / "Redelijk zeker"
      low: string          // "Not sure — pick one manually or try a better photo"
      compareCandidates: string // prompt to compare top 2–3 candidates
      // Short chip labels next to the confidence dot on the results sheet
      chip: {
        high: string     // "Likely correct"
        medium: string   // "Compare carefully"
        low: string      // "Uncertain"
        no_match: string // "No match"
      }
      summary: {
        high: { label: string; body: string }
        medium: { label: string; body: string }
        low: { label: string; body: string }
        no_match: { label: string; body: string }
      }
    }
    guidance: {
      title: string
      items: string[]
      safety: string
    }
    noMatch: {
      title: string           // "No match found"
      body: string            // "Try a different photo or add the plant manually."
      bodyDetailed: string    // "No identification. Try another photo (focus closer on a leaf or flower)."
      retry: string           // "Try again"
      manualFallback: string  // "Enter manually"
    }
    errorOffline: string  // "Identification needs an internet connection"
    errorService: string  // "Could not reach the identification service"
    errorQuota: string    // "Identification temporarily unavailable (daily limit)"
    privacy: {
      notice: string  // "Photos are sent to Pl@ntNet for identification."
      ack: string     // "OK, got it"
    }
    card: {
      title: string     // "Photo identification"
      subtitle: string  // "Take a photo to identify a plant"
    }
    ecologyTitle: string         // "Wat je net vond"
    ecologyFillsGap: string      // "Vult je tuinkalender in {months}"
    ecologyContinue: string      // "Doorgaan met toevoegen"
  }

  editPlant: {
    title: string            // "Edit plant"
    previewEyebrow: string   // desktop preview rail label
    changePhoto: string      // desktop preview photo hover pill
    addPhoto: string         // "Add photo"
    readOnlyTitle: string    // "Editing plants is for editors"
    readOnlyBody: string     // "You can read the plant's page, but only editors can change it."
    plantPhoto: string       // "Plant photo"
    tapToChangePhoto: string // "Tap to change photo"
    previewAlt: string       // "Preview"
    nameLabel: string        // "Name *"
    speciesLabel: string     // "Botanical name"
    speciesPlaceholder: string // "Monstera deliciosa"
    iconLabel: string        // "Icon"
    sunRequirementLabel: string // "Sun requirement"
    locationLabel: string    // "Location"
    garden: string           // "Garden"
    house: string            // "House"
    mapComingSoon: string    // "Map coming soon"
    potSizeLabel: string     // "Pot size (cm)"
    potSizePlaceholder: string // "15"
    acquiredLabel: string    // "Acquired"
    lastRepottedLabel: string // "Last repotted"
    lastRepottedDescription: string
    acquiredDescription: string
    historyEyebrow: string
    historyTitle: string
    photoReminderManage: string
    historySubtitle: string
    careEnvironmentNote: (environment: string, count: number) => string
    careEnvironments: Record<'indoor' | 'outdoor_container' | 'outdoor_ground', string>
    containerLabel: string
    containerDescription: string
    containerNone: string
    speciesUnknown: string
    speciesWillRelink: string
    speciesWillUnlink: string
    measuredSunLabel: string
    measuredSunDescription: string
    measuredSunEstimate: (hours: string) => string
    measuredSunNoEstimate: string
    acquiredFromLabel: string
    acquiredFromDescription: string
    acquiredFromPlaceholder: string
    iconDescription: string
    notesLabel: string       // "Notes"
    notesPlaceholder: string // "Likes indirect light, water from below..."
    saving: string           // "Saving..."
    saveFailed: string       // "Couldn't save — please try again."
    databasePrefill: string  // "Filled from plant database — adjust where needed"
    careScheduleTitle: string // "Care schedule"
    careScheduleDesc: string  // "How often does this plant need care?"
    everyLabel: string        // "every"
    daysLabel: string         // "days"
    careRhythmLabel: string
    careRhythmDescription: string
    submitting: string        // "Adding..."
    // Sun requirement profile labels
    sunFull: string          // "Full sun"
    sunPartial: string       // "Partial sun"
    sunShade: string         // "Shade"
    // Growth phases (Groeifasen)
    growthPhaseLabel: string  // "Growth phase"
    sownDateLabel: string     // "Sown date"
    phaseSeed: string         // "Seed"
    phaseSprout: string       // "Sprout"
    phaseSeedling: string     // "Seedling"
    phaseYoung: string        // "Young plant"
    phaseEstablished: string  // "Established"
    mulchLabel: string        // "Mulch"
    mulchDescription: string  // "Mulch holds moisture in the soil — lowers watering pressure."
  }

  // ── Calendar page ───────────────────────────────────────────────
  calendar: {
    title: string  // "Calendar"
    gardenYear: string  // "Garden Year"
    subtitle: string  // "Everything your garden asks for - and everything it promises - ordered by day."
    week: string
    month: string
    agenda: string
    workAgendaHeading: string
    workAgendaSubtitle: string
    gardenYearSubtitle: string  // lede when the Garden Year view is active
    filterLabel: string         // mono micro-label before the environment pills ("Locatie")
    workAgendaLoadFailed: string
    monthLoadFailed: string
    retry: string
    thisMonth: string
    planned: string
    previousMonth: string
    nextMonth: string
    tasks: string  // "tasks"
    taskSingular: string  // "task"
    bloom: string  // "Bloom"
    open: string  // "Open"
    completedHistory: string
    seasonalThisMonth: string
    seasonalScope: string
    seasonalMissing: (n: number) => string
    seasonalMore: (n: number) => string
    seasonalGardenYear: string
    waterOutlookTitle: string
    waterOutlookScope: string
    waterOutlookGlobalOutdoor: string
    waterOutlookGlobalIndoor: string
    waterOutlookGlobalMixed: string
    waterOutlookGlobalNormal: string
    waterOutlookGlobalUnavailable: string
    waterOutlookCheckDateShort: (date: string) => string
    waterOutlookDeadlinesUnchanged: string
    waterOutlookLoading: string
    waterOutlookError: string
    waterOutlookRetry: string
    waterOutlookProxy: string
    waterOutlookCheckDate: (date: string) => string
    waterOutlookSavedDate: (date: string) => string
    waterOutlookOverdueDate: (date: string) => string
    waterOutlookLevelHigh: string
    waterOutlookLevelElevated: string
    waterOutlookLevelNormal: string
    waterOutlookLevelUnknown: string
    waterOutlookStale: string
    waterOutlookUnavailable: string
    waterOutlookMissingCoordinates: string
    fieldNote: string
    weatherContext: string
    weatherRecommendedAction: string
    weatherExplanationUnavailable: string
    completionConfirmed: string
    completionPlant: (name: string | null) => string
    completionMap: (name: string | null) => string
    reviewHistory: string
    addPhoto: string
    viewMap: string
    dismissCompletion: string
    filter: string
    heading: string  // "Calendar"
    filterDescAll: string      // "alle planten" / "all plants"
    filterDescGarden: string    // "buitenplanten" / "outdoor plants"
    filterDescHouse: string     // "kamerplanten" / "indoor plants"
    moonPhase: string  // "Moon phase"
    agendaSelectedDay: string  // "Agenda — selected day"
    noTasksRest: string  // "No tasks — rest."
    freeDay: string  // "Free day"
    gardenManagesItself: string  // "The garden takes care of itself today."
    today: string  // "today"
    overdueLabel: string  // "Overdue"
    editLabel: string  // "Edit"
    completeAndAlign: string  // "Complete & align"
    undoGroup: string  // "Undo group"
    completedGroup: string  // "Watered and aligned"
    affectedPlants: (n: number) => string  // "3 affected plants"
    weatherAffectedSummary: (n: number, type: 'heat_protect' | 'frost_protect') => string
    showPlants: string
    hidePlants: string
    sessionLoad: (n: number) => string  // "3 sessions"
    wateringRoundTitle: string
    wateringRoundDescription: string
    wateringRoundDueDate: (date: string) => string
    wateringRoundSelectAll: string
    wateringRoundSelectNone: string
    wateringRoundCancel: string
    wateringRoundConfirm: (n: number) => string
    wateringRoundSelectAtLeastOne: string
    moistureCheckTitle: string
    moistureCheckAction: string
    moistureCheckDescription: string
    moistureCheckStillMoist: (n: number) => string
    moistureCheckWatered: (n: number) => string
    moistureCheckResolvedStillMoist: string
    moistureCheckResolvedWatered: string
    // Moon short labels
    newMoon: string  // "new"
    fullMoon: string  // "full"
    quarterMoon: string  // "quarter"
    more: (n: number) => string  // "+ {n} more"
    // Moon phase long labels
    moonNew: string
    moonWaxingCrescent: string
    moonFirstQuarter: string
    moonWaxingGibbous: string
    moonFull: string
    moonWaningGibbous: string
    moonLastQuarter: string
    moonWaningCrescent: string
    // Month labels (short)
    monthsShort: [string, string, string, string, string, string, string, string, string, string, string, string]
    // Day letters (header)
    dayLetters: [string, string, string, string, string, string, string]
    // Month labels (long)
    monthsLong: [string, string, string, string, string, string, string, string, string, string, string, string]
  }

  // ── Add Object sheet ────────────────────────────────────────────
  addObject: {
    title: string  // "Add object"
    containers: string
    hardscape: string  // "Hardscape & Utility"
    name: string
    namePlaceholder: string  // "e.g. Front deck pot"
    label: string
    shape: string
    shapeRound: string
    shapeSquare: string
    shapeRect: string
    round: string
    square: string
    rect: string
    dimensions: string  // "Dimensions (cm)"
    diameter: string
    width: string
    depth: string
    material: string
    color: string
    addToMap: string
    adding: string  // "Adding..."
    addPlant: string
    hidePlantPicker: string
    assignPlant: string
    noStandalonePlants: string
    plantsInside: (n: number) => string
    remove: string
    edit: string
    editObject: string
    removeObject: string
    saving: string
    save: string
    cancel: string
    archive: (name: string) => string
  }

  // ── Utility / event-type labels (used across calendar + care) ───
  utility: {
    eventWater: string
    eventFertilize: string
    eventPrune: string
    eventRepot: string
    eventMist: string
    eventColdProtection: string
    eventHeatProtection: string
    eventMoistureCheck: string
    eventBloom: string
    eventSow: string
    eventHarvest: string
    eventScan: string
    eventRain: string
    eventRotate: string
    eventDust: string
    eventPestCheck: string
  }

  // ── Plants page (list view) ──────────────────────────────
  plantsPage: {
    title: string           // "Planten Icons."
    subtitle: string        // "Een botanische gids voor je plantencollectie — binnen en buiten."
    subtitleEst: string     // "Mijn Tuin · Est. 2026"
    countPlants: string     // "Planten" (plural label next to count)
    countCategories: string // "Categorieën" (plural label next to count)
    searchPlaceholder: string // "Zoek op naam of soort…"
    addButton: string       // "+ Toevoegen"
    filterButton: string    // "Filters"
    filterLocation: string  // "Locatie"
    filterType: string      // "Type"
    filterForm: string      // "Vorm"
    filterAll: string       // "Alle"
    filterHouse: string     // "Huis"
    filterGarden: string    // "Tuin"
    alertBanner: string     // "⚠️ Planten met weeralerts"
    alertShowAll: string    // "Alles tonen"
    found: (n: number) => string      // "Gevonden: {n}"
    showAll: (n: number) => string    // "Toon alle {n} planten"
    sectionSearchResults: string      // "§ Zoekresultaten"
    sectionGarden: string             // "§ De Tuin"
    sectionHouse: string              // "§ Huis"
    sectionCollection: string         // "§ De Collectie"
    emptySearch: string               // "Niets gevonden in deze hoek van de tuin."
    emptyNoPlants: string             // "Nog geen planten in deze collectie."
    emptySearchHint: string           // "Probeer een andere zoekopdracht"
    emptyNoPlantsHint: string         // "Voeg je eerste plant toe via + Toevoegen"
    select: string                    // "Selecteer" / "Select"
    selected: (n: number) => string   // "2 planten geselecteerd"
    bulkArchiveBtn: (n: number) => string   // "Archiveer (2)"
    bulkArchiveConfirm: (n: number) => string  // confirm dialog text
    renameHint: string                // aria-label for rename button
    recentCare: string                // "Recent care" — recent-care feed header
  }

  // ── Map page (garden/indoor view) ────────────────────────
  mapPage: {
    notFound: string          // "Map not found"
    mapSettings: string       // "Kaart instellingen" (settings button tooltip)
    labelShow: string         // "Toon namen"
    labelHide: string         // "Verberg namen"
    labelModeTitle: string    // "Namen" (labels section heading)
    labelModeOff: string      // "Uit"
    labelModeSmart: string    // "Slim"
    labelModeAll: string      // "Alles"
    warningsShow: string      // "Toon waarschuwingen"
    warningsHide: string      // "Verberg waarschuwingen"
    weatherWarningBadge: string
    weatherWarningAction: string
    weatherGuidance: string
    weatherGotIt: string
    weatherHighlightPlants: string
    weatherHidePlantMarkers: string
    weatherSeenGuidance: string
    weatherRestore: string
    water: string             // "Bewater" (garden watering button)
    fertilize: string         // "Bemest" (garden fertilize button)
    sun: string               // "Zon"
    inspect: string           // "Inspecteer"
    pot: string               // "Pot"
    plant: string             // "Plant"
    saveLabel: string         // "Opslaan"
    clearLabel: string        // "Wis"
    lastWatered: (date: string) => string   // "Laatst bewaterd: {date}"
    recordWatering: string                  // "Registreer tuin bewatering"
    lastFertilized: (date: string) => string // "Laatst bemest: {date}"
    recordFertilizing: string               // "Registreer tuin bemesting"
    gardenActionClose: string               // "Close" / "Sluiten"
    gardenActionScope: string               // "This applies to all plants on this map at once."
    gardenActionDateLabel: string           // "Date" / "Datum"
    gardenWaterButton: string               // "Water all plants"
    gardenWaterDelete: string               // "Delete watering"
    gardenFertilizeButton: string           // "Fertilize all plants"
    gardenFertilizeDelete: string           // "Delete fertilizing"
    mapWateringDescription: string
    mapWateringLastRound: string
    mapWateringHistory: string
    mapWateringRoundMeta: (date: string, member: string, plantCount: string) => string
    mapWateringUnknownMember: string
    mapWateringUndo: string
    mapWateringLastWateredTitle: (date: string) => string
    mapWateringNoHistoryTitle: string
    mapWateringLoading: string
    mapWateringLoadError: string
    mapWateringError: string
    addPot: string                          // "Pot toevoegen"
    more: string                             // "Meer" / "More" (mobile overflow menu button)
    options: string                          // "Opties" / "Options" (mobile menu trigger)
    deleted: (label: string) => string      // "Verwijderd: {label}"
    undo: string                            // "Ongedaan maken"
    soilDefaultName: string                 // "Grond"
    switchMap: string                       // "Wisselen…" / "Switch map…"
    mapSettingsLabel: string               // "Instellingen…" / "Settings…"
    downloadMap: string                    // "Download map" / "Kaart downloaden"
    downloadingMap: string                 // "Preparing…" / "Voorbereiden…"
    sheetAttentionCount: (n: number) => string  // "3 planten hebben aandacht"
    sheetAllGood: string                         // "Alles op schema"
    sheetGlobalAttention: (n: number) => string  // "3 planten in je tuinen hebben aandacht"
    sheetAllGoodGlobal: string                   // "Alles goed in je tuinen"
    sheetOtherGardenHint: string                 // "in een andere tuin"
    careDone: string                             // "Klaar" — mark care done
    careSkip: string                             // "Overslaan" — skip care
    careDoneAll: string                          // "Alles klaar" — bulk-complete a care action
    sheetNeedsAttention: string                  // "Nu nodig" — heading for due/overdue care
    sheetLaterThisWeek: (n: number) => string    // "Later deze week · 42"
    sheetGardenCount: (n: number) => string      // "in 2 tuinen"
    sheetPlantCount: (n: number) => string       // "32 planten"
    // Weather pill (outdoor maps)
    weatherConditions: {
      sun: string
      partly: string
      rain: string
      snow: string
      thunder: string
    }
    weatherTodayRain: string                     // "Regen vandaag" — today's rainfall label
    weatherForecastLink: string                  // "Bekijk kalender →" — link to /calendar
    unplacedTitle: string                        // "Nog te plaatsen" — unplaced tray header
    unplacedCount: (n: number) => string         // "{n} niet geplaatst"
    spotInspectorHint: string
    moveMode: string
    moveModeDone: string
    moveModeHint: string
    moveOnePlantHint: string
    placeSpotHint: (name: string) => string
    sunNoGpsHint: string    // "Set garden location first to use sun features"
    plantHitChooserTitle: string
    plantHitChooserClose: string
  }

  garden: {
    biodiversity: {
      title: string             // "Biodiversiteit" / "Biodiversity"
      loading: string           // "Laden..."
      failed: string            // "Kon niet laden"
      emptyGarden: string       // "Voeg planten toe om biodiversiteit bij te houden"
      speciesCount: (n: number) => string  // "5 soorten"
      nativeCount: (n: number) => string   // "3 inheems"
      invasiveCount: (n: number) => string // "1 invasief"
      pollinatorMonths: string  // "Bloeimaanden voor bestuivers"
      componentPollinator: string // "Bestuivers"
      componentNative: string     // "Inheems"
      componentDiversity: string  // "Diversiteit"
      componentStreek: string     // "Streek"
      componentAbundance: string  // "Aantal" / "Abundance"
      streekLabel: string         // "Streek" (row label)
      streekNativeCount: (n: number) => string  // "3 streekeigen soorten"
      drachtplantCount: (n: number) => string   // "4 bijenplanten (drachtplanten)"
      soilPhLabel: string         // "Bodem" (soil-pH advice row label)
      soilPhAcid: string          // advice: plants prefer lime-free/acid soil
      soilPhAlkaline: string      // advice: plants prefer chalky/alkaline soil
      soilPhMixed: string         // advice: garden mixes acid- and lime-lovers
      carbonLabel: string         // "Koolstof" (carbon proxy row label)
      carbonStrong: string        // advice: lots of woody planting stores carbon
      carbonLow: string           // advice: no woody planting yet
      groundCoverLabel: string    // "Bodembedekking" (ground-cover row label)
      groundCoverAdd: string      // advice: no ground cover yet, add some
      circularity: {
        title: string     // "Kringloop"
        hint: string      // "Vink aan wat je al doet"
        compost: string   // "Composteren"
        mulch: string     // "Mulchen"
        rainwater: string // "Regenwater opvangen"
        peatFree: string  // "Turfvrij tuinieren"
      }
      features: {
        title: string          // "Voorzieningen"
        hint: string           // "Schuilplaats, nestgelegenheid en water"
        insectHotel: string    // "Insectenhotel"
        birdHouse: string      // "Nestkast"
        water: string          // "Water"
        logPile: string        // "Takkenril"
        stonePile: string      // "Steenhoop"
        hedgehogHouse: string  // "Egelhuisje"
        batBox: string         // "Vleermuiskast"
        supportsLabel: string  // "Je ondersteunt"
        missingLabel: string   // "Kansen"
        faunaBees: string      // "solitaire bijen"
        faunaInsects: string   // "insecten"
        faunaBirds: string     // "vogels"
        faunaHedgehogs: string // "egels"
        faunaAmphibians: string // "amfibieën"
        faunaBats: string      // "vleermuizen"
      }
    }
    suggestions: {
      title: string        // "Verbeter je tuin"
      gapLabel: string     // "Maanden zonder bestuivers: {months}"
      noData: string       // "Voeg planten toe om aanbevelingen te zien"
      sunFull: string      // "☀️ Volle zon"
      sunPartial: string   // "⛅ Halfschaduw"
      sunShade: string     // "🌿 Schaduw"
      nativeBadge: string  // "Inheems 🇳🇱" / "Native 🇳🇱"
      streekBadge: string  // "Streekeigen" / "Regional"
      sizeBadge: string    // "🌳 Grote plant" / "🌳 Large — needs space"
      altPrefix: string    // "Geen ruimte?" / "No room?"
      dismiss: string      // "Niet tonen" / "Not for me"
      dismissUndo: string  // "Ongedaan maken" / "Undo"
      lanes: {
        gap: string      // "Vult je bloeigat: {months}" / "Fills your bloom gap: {months}"
        impact: string   // "Grootste impact" / "Biggest impact"
        easy: string     // "Klein & makkelijk" / "Small & easy"
        moth: string     // "Voor nachtvlinders" / "For night moths"
        more: string     // "Meer opties" / "More options"
      }
    }
    streek: {
      sectionTitle: string          // "Planten uit jouw streek"
      subtitle: (name: string) => string  // "Inheems in het/de {name}"
      noData: string                // "Nog geen streekplanten om te tonen"
      attribution: string           // "Streekindeling: streektuinen.nl"
      pickTitle: string             // "Kies je streek"
      pickHint: string              // "Klopt je streek niet? Kies hem hieronder."
      pickNone: string              // "Onbekend / buiten Nederland"
      pickCta: string               // "Opslaan"
      seedMix: string               // "Zaaimengsel voor jouw streek" / "Seed mix for your region"
    }
    sources: {
      title: string                 // "Bronnen" / "Sources"
      streektuinen: string          // "Streekindeling & planten: streektuinen.nl"
      bloeibogen: string            // "Bijen & bloeidata: Naturalis / Bloeibogen"
    }
    bees: {
      title: string                          // "Bijen" / "Wild bees"
      supportedCount: (n: number) => string  // "Tot 40 wilde bijensoorten kunnen hier terecht"
      redlistNote: (m: number) => string     // "waarvan 12 op de Rode Lijst"
      forageGap: (months: string) => string  // "Bijen vliegen in feb, mrt zonder drachtplant…"
      noForage: string                        // "Nog geen drachtplanten…"
    }
  }

  // ── Map legend ──────────────────────────────────────────────────
  mapLegend: {
    attentionNeeded: string  // "Attention needed" / "Aandacht nodig"
    allGood: string          // "All good" / "Alles goed"
  }

  // ── Onboarding checklist ────────────────────────────────────────
  onboarding: {
    title: string        // "Welkom bij Floreren!"
    firstRunLede: string // overlay subtitle on the map: "Drie stappen om je tuin tot leven te brengen."
    stepLabel: (current: number, total: number) => string  // "Stap 1 van 2"
    createMap: {
      label: string     // "Maak je eerste tuin"
      cta: string       // "Tuin aanmaken"
    }
    drawLayout: {
      label: string     // "Teken je tuinindeling"
      cta: string       // "Indeling tekenen"
    }
    setLocation: {
      label: string     // "Stel de locatie van je tuin in" (outdoor only, no GPS yet)
      cta: string       // "Locatie instellen"
    }
    addPlant: {
      label: string     // "Voeg je eerste plant toe"
      cta: string       // "Plant toevoegen"
    }
    installApp: {
      label: string     // "Voeg toe aan beginscherm"
      hintIos: string   // "Deel → Zet op beginscherm"
      hintAndroid: string // "Menu → Toevoegen aan startscherm"
      done: string      // "Al geïnstalleerd ✓"
    }
    dismiss: string     // "Sluiten" / "Dismiss"
    completed: string   // "✅ Klaar! Je hebt alle stappen voltooid"
  }

  installPrompt: {
    iosKicker: string        // "Zet Floreren op je beginscherm"
    iosTitle: string         // "Voeg Floreren toe aan je beginscherm"
    iosLede: string          // "Zo werkt het in Safari:"
    iosStepShare: string     // "Tik op het deel-icoon (vierkant met pijl)"
    iosStepHomeScreen: string // "Kies 'Zet op beginscherm'"
    iosStepAdd: string       // "Tik op 'Voeg toe' rechtsboven"
    iosPushHook: string      // "Alleen geïnstalleerd krijg je meldingen"
    iosCta: string           // "Ik heb dit gedaan"
    androidKicker: string    // "Installeer Floreren"
    androidTitle: string     // "Installeer Floreren op je telefoon"
    androidLede: string      // "Eén tik — daarna werkt Floreren als een app."
    androidPushHook: string  // "Krijg waterherinneringen als melding"
    androidCta: string       // "Installeren"
    installing: string       // "Bezig…"
    doneTitle: string        // "Floreren staat op je beginscherm! 🎉"
    doneLede: string         // "Open het de volgende keer vanaf je beginscherm — geen computer nodig."
    noPromptTitle: string
    noPromptLede: string
    noPromptHint: string
    noPromptClose: string
    later: string            // "Later"
  }

  installNudge: {
    title: string            // "Floreren als app?"
    subtitle: string         // "Installeer — dan staat hij altijd op je telefoon"
    cta: string              // "Installeren"
    dismissAria: string      // "Nudge verbergen"
  }

  weeds: {
    identifyCard: {
      title: string
      subtitle: string
    }
    privacy: {
      notice: string
      ack: string
    }
    identifying: string
    noMatch: {
      retry: string
      dismiss: string
    }
    knownWeed: string
    notAWeed: string
    logSighting: string
    sightingSheet: {
      title: string
      pickMap: string
      pinInstruction: string
      confirm: string
      cancel: string
      saved: string
    }
    errorService: string

    sightingsList: {
      title: string
      empty: string
      emptyHint: string
      mapLabel: string
      deleteConfirm: string
      detailTitle: string
      sightedOn: string
      location: string
      removal: string
      removalDifficulty: string
      notes: string
      deleteSighting: string
      noPhoto: string
      loading: string
      loadingDetail: string
      fieldGuide: string
      funFact: string
      habitat: string
      appearance: string
      native: string
      edible: string
      flowering: string
      removalTip: string
    }
  }

  help: {
    title: string
    close: string
    dismiss: string
    askStekkie: string
    subtitle: (name: string) => string
    disclaimer: string
    bubbles: string[]
    tips: {
      dashboard: string
      plants: string
      maps: string
      calendar: string
      settings: string
      editor: string
      plantDetail: string
      addPlant: string
    }
    chat: {
      inputPlaceholder: string
      send: string
      thinking: string
      error: string
      unavailable: string
      empty: string
      example: string
      expand: string
      collapse: string
      actionConfirm: string
      actionCancel: string
      actionDone: string
      actionError: string
    }
    // One free-text box → Stekkie drafts a GitHub issue → user confirms.
    feedback: {
      open: string
      header: string
      prompt: string
      placeholder: string
      chatAttached: string
      next: string
      drafting: string
      previewTitle: string
      previewHint: string
      fallbackHint: string
      kindBug: string
      kindFeature: string
      kindQuestion: string
      back: string
      submit: string
      submitting: string
      doneBug: string
      doneFeature: string
      viewIssue: string
      error: string
    }
  }

  log: {
    title: string
    empty: string
    loadMore: string
    fieldObservation: string
  }

  outage: {
    quota: { title: string; body: string }
    unreachable: { title: string; body: string }
  }
  common: {
    loading: string
    notFound: string
    save: string
    cancel: string
    close: string       // "Close" / "Sluiten"
    delete: string
    back: string
    error: string
    retry: string
    saving: string       // "Saving..." / "Opslaan..."
    saved: string        // "Saved" / "Opgeslagen"
    deleting: string     // "Deleting..." / "Verwijderen..."
    all: string          // "Alles" / "All"
    garden: string       // "Tuin" / "Garden"
    house: string        // "Huis" / "House"
    envGround: string    // "Ground" / "Grond"
    envPotted: string    // "Potted" / "Pot"
    envIndoor: string    // "Indoor" / "Binnen"
    on: string
    off: string
  }

  discovery: {
    // Entry point (Plants page button)
    identifyWild: string       // "Identificeer in het wild"
    identifyWildSubtitle: string  // "Fotografeer een plant buiten en leer er meer over"
    // DiscoveryCard page
    funFact: string            // "Wist je dat..."
    funFactLoading: string     // "Weetje laden..."
    funFactError: string       // "Kon geen weetje laden"
    funFactRetry: string
    closeEntry: string
    previousEntry: string
    nextEntry: string
    readOnWikipedia: string
    /** Named article link, e.g. "Read on Wikipedia: Madeliefje". */
    readOnWikipediaNamed: (title: string) => string
    searchOnWikipedia: string
    wikipediaLoading: string
    wikipediaEnglishOnly: string
    /** Species lookup failed — shown instead of a fun-fact error, with a retry. */
    speciesLinkFailed: string
    /** Identified, but the species is not in the catalog: no facts to show. */
    speciesUnknown: string
    viewInJournal: string
    ecology: string            // "Ecologie"
    ecologyLoading: string     // "Ecologie laden..."
    nativeNl: string           // "Inheems in NL"
    invasiveNl: string         // "Invasief in NL"
    pollinatorHigh: string     // "Top bestuiversplant"
    pollinatorGood: string     // "Goed voor bijen"
    pollinatorLow: string      // "Enige waarde voor bestuivers"
    floweringMonths: string    // "Bloeiperiode"
    gardenFit: string          // "Tuinadvies"
    gardenFitLoading: string   // "Tuinadvies laden..."
    gardenFitNone: string      // "Geen tuinen gevonden"
    fitPerfect: string         // "Ideaal licht"
    fitAcceptable: string      // "Geschikt licht"
    fitMarginal: string        // "Krap licht"
    fitTolerated: string       // "Past overal"
    fitNone: string            // "Waarschijnlijk te donker"
    fitUnknown: string         // "Licht onbekend"
    saveToJournal: string      // "Opslaan in veldboek"
    savedToJournal: string     // "Opgeslagen!"
    addToGarden: string        // "Toevoegen aan tuin"
    // Journal tab (Plants page)
    journalTab: string         // "Veldboek"
    myPlantsTab: string        // "Mijn planten"
    journalEmpty: string       // "Nog geen veldwaarnemingen"
    journalEmptyHint: string   // "Fotografeer planten buiten met de camera-knop"
    journalDeleteConfirm: string  // "Waarneming verwijderen?"
    discovered: string         // "Gevonden"
    share: string              // "Delen"
    shareCopied: string        // "Gekopieerd!"
    journalNotes: string       // "Notes" / "Notities"
    journalLocation: string    // "Photo location" / "Fotolocatie"
    journalOpenMap: string     // "Open map" / "Open kaart"
    journalAddLocation: string
    journalAddingLocation: string
    journalLocationError: string
    saveError: string          // "Opslaan mislukt, probeer opnieuw"
    noPlantData: string        // "Geen plantdata beschikbaar."
    back: string               // "Terug"
    // ── Veldgids (field guide) page — issue #564 ──
    guideEyebrow: string
    guideTitle: string
    guideAccent: string
    guideLede: string
    statFinds: string
    statSpecies: string
    statPlaces: string
    expeditionMap: string
    mapClickHint: string
    scopeAll: string      // "Alle waarnemingen" — household-wide view
    scopeMine: string     // "Mijn waarnemingen" — viewer's own finds
    journalEmptyMine: string  // empty state when scope=mine has no finds yet
    filterAll: string
    filterNative: string
    entryNoPrefix: string   // "Waarneming nr." — number appended in code
    notesPlaceholder: string
    notesEdit: string
    notesSave: string
    notesSaving: string
    bloomShort: string      // "Bloeit" — flowering months appended
    exportCsv: string
  }

  study: {
    title: string
    entryTitle: string
    entryBody: string
    entryStart: string
    dueCount: string
    correct: string
    wrong: string
    check: string
    dontKnow: string
    next: string
    back: string
    typePlaceholder: string
    typeHint: string
    caughtUpTitle: string
    caughtUpBody: string
    learnedCount: string
    noMaterialTitle: string
    noMaterialBody: string
  }
  game: {
    // Setup
    newGame: string
    setupTitle: string
    setupSubtitle: string
    selectMin: string
    selectMax: string
    createGame: string
    creating: string
    noPhotosWarning: string
    noPlantsWithPhotos: string
    // Waiting room (host)
    joinCode: string
    copyLink: string
    linkCopied: string
    waitingForPlayers: string
    playersJoined: string
    startGame: string
    cancelGame: string
    minPlayersHint: string
    // Waiting room (player)
    enterCode: string
    joinButton: string
    invalidCode: string
    gameAlreadyStarted: string
    waitingForHost: string
    youAreIn: string
    otherPlayers: string
    // Round
    roundTitle: string
    findThisPlant: string
    hint: string
    scanButton: string
    scanning: string
    correctScan: string
    wrongScan: string
    waitingForNextRound: string
    noPhotoAvailable: string
    roundOf: string
    // Round result
    roundResult: string
    correct: string
    tooSlow: string
    pointsEarned: string
    totalScore: string
    nextRoundSoon: string
    // Host round view
    answered: string
    waitingForAnswers: string
    nextRound: string
    endGame: string
    plantHint: string
    revealAnswer: string
    hideAnswer: string
    backToRound: string
    // Leaderboard
    gameOver: string
    finalLeaderboard: string
    yourPosition: string
    playAgain: string
    backToMap: string
    shareResults: string
    newGame2: string
    roundBreakdown: string
    matchHow: string
    matchPhoto: string
    matchName: string
    matchNameNear: string
    matchCommon: string
    matchGenus: string
    matchUnknown: string
    scanToJoin: string
    hostedBy: string
    place1: string
    place2: string
    place3: string
    // Clue mode
    clueModePhoto: string
    clueModeName: string
    clueModeSectionLabel: string
    clueModeLogbook: string
    selectAll: string
    deselectAll: string
    questionCount: string
    allQuestions: string
    // Guest join (party mode)
    gameName: string
    yourName: string
    yourNamePlaceholder: string
    noAccountNeeded: string
    joinFailed: string
    gameAlreadyFinished: string
    previewHosted: string
    previewPlayers: string
    sessionLost: string
    rejoin: string
    waitingForPlayersHint: string
    // Maps + pacing
    mapsSectionLabel: string
    pacingSectionLabel: string
    pacingRace: string
    pacingHost: string
    pacingRaceHint: string
    pacingHostHint: string
    roundLength: string
    sitOut: string
    speedBonus: string
    joinIn: string
    forfeitSectionLabel: string
    forfeitPlaceholder: string
    forfeitHint: string
    forfeitLabel: string
    forfeitLoser: string
    forfeitLine: string
    lockedOutTitle: string
    lockedOutBody: string
    attemptsLeft: string
    oneAttemptLeft: string
    quickTitle: string
    quickSubtitle: string
    quickStart: string
    quickReadyCount: string
    quickNotEnough: string
    photoReady: string
    clueModeNameHint: string
    clueModePhotoHint: string
    clueModeLogbookHint: string
    unlinkedSpeciesWarning: string
    notIdentifiable: string
    // Race round
    foundCount: string
    waitingForRoundEnd: string
    firstToFind: string
    skipRound: string
    tryAgain: string
    continue: string
    weSaw: string
    // Host override
    awardHint: string
    awardPlayer: string
    // Sharing
    roundsCount: string
    pointsShort: string
    quizWhichPlant: string
    quizWhichPhoto: string
    quizAnswered: string
  }

  appUpdate: {
    available: string  // "Nieuwe versie beschikbaar"
    action: string     // "Vernieuwen"
    dismiss: string    // "Sluiten"
  }

  demo: {
    badge: string       // "Demo"
    gardenName: string  // "Voorbeeldtuin"
    cta: string         // "Maak je eigen tuin"
    hint: string        // sun-mode explainer shown on the public demo garden
  }
}
