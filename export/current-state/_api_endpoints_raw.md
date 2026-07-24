## account.ts
- GET /overview
- POST /delete/cancel

## activity-imports.ts
- GET /
- POST /
- PATCH /:id/link
- DELETE /:id

## admin.ts
- GET /whoami
- GET /status
- POST /reset-onboarding
- GET /health
- POST /health/run
- GET /testers
- GET /test-dashboard
- GET /feedback
- GET /failed-imports
- GET /health/batches
- GET /security
- GET /quality
- GET /ai-insights
- GET /data-provenance

## ai.ts
- POST /brief
- POST /ask
- GET /observations
- GET /sources
- POST /connections
- PATCH /observations/:id
- GET /preferences
- PUT /preferences
- POST /workout-explain
- POST /workout-explain-extended
- POST /workout-adjust

## alerts.ts
- POST /crash

## analysis-feedback.ts
- POST /
- GET /

## athlete.ts
- GET /profile
- PUT /profile
- PUT /health-status
- GET /dashboard
- GET /workouts/today
- GET /workouts
- POST /workouts
- PUT /workouts/:id
- DELETE /workouts/:id
- GET /workouts/:id/history
- GET /workouts/:id
- POST /workouts/:id/feedback
- GET /life-events
- POST /life-events
- DELETE /life-events/:id
- POST /plan/generate
- GET /sessions
- GET /sessions/:id
- POST /sessions/:id/trim-preview
- POST /sessions/:id/trim
- DELETE /sessions/:id/trim
- POST /sessions
- PUT /sessions/:id
- GET /metrics
- POST /metrics
- GET /load
- GET /power-bests
- GET /ftp
- POST /ftp

## audio.ts
- GET /preferences
- PUT /preferences

## auth.ts
- POST /sync
- GET /me
- PUT /me/role

## bike-scan.ts
- POST /start
- POST /:scanId/frame
- POST /frame/:frameId/cutout
- POST /:scanId/complete
- GET /bike/:bikeId
- GET /frame/:frameId/:kind
- DELETE /bike/:bikeId
- GET /assets
- POST /assets
- GET /assets/:id/image
- DELETE /assets/:id

## bug-reports.ts
- POST /
- GET /mine
- GET /admin
- PATCH /admin/:id
- GET /:id/comments
- POST /:id/comments

## calendar.ts
- GET /sources
- GET /search
- GET /event

## climbs.ts
- GET /search
- GET /detail

## club.ts
- POST /
- GET /
- POST /join
- GET /:clubId
- PUT /:clubId
- POST /:clubId/join-code
- GET /:clubId/locations
- POST /:clubId/locations
- PUT /:clubId/locations/:locationId
- GET /:clubId/calendar
- GET /:clubId/subscription
- PUT /:clubId/subscription
- GET /:clubId/members
- PUT /:clubId/members/:memberId/role
- POST /:clubId/members/:memberId/end
- POST /:clubId/teams
- PUT /:clubId/teams/:teamId
- POST /:clubId/groups
- POST /:clubId/teams/:teamId/members
- POST /:clubId/groups/:groupId/members
- POST /:clubId/trainer-assignments
- POST /:clubId/trainings
- GET /:clubId/trainings
- PUT /:clubId/trainings/:trainingId
- POST /:clubId/trainings/:trainingId/signup
- POST /:clubId/trainings/:trainingId/link-schedule
- PUT /:clubId/trainings/:trainingId/attendance
- POST /:clubId/races
- GET /:clubId/races
- PUT /:clubId/races/:eventId
- POST /:clubId/races/:eventId/selection
- PUT /:clubId/races/:eventId/availability
- POST /:clubId/messages
- GET /:clubId/messages
- POST /:clubId/messages/:messageId/read
- GET /:clubId/consents/mine
- POST /:clubId/consents
- GET /:clubId/trainer/athletes
- GET /:clubId/trainer/athletes/:athleteId/summary
- GET /:clubId/export
- GET /:clubId/audit

## coach-cockpit.ts
- GET /dashboard
- GET /athletes/:athleteId/signals
- POST /athletes/:athleteId/review
- GET /athletes/:athleteId/workouts
- POST /athletes/:athleteId/workouts
- POST /workouts/bulk
- GET /athletes/:athleteId/proposals
- POST /proposals/:proposalId/decision
- GET /athletes/:athleteId/messages
- POST /athletes/:athleteId/messages
- GET /messages
- POST /messages/reply
- GET /athletes/:athleteId/context-items
- POST /athletes/:athleteId/context-items
- PUT /context-items/:itemId
- DELETE /context-items/:itemId
- GET /context-items/about-me

## coach.ts
- GET /athletes
- GET /athletes/:athleteId
- GET /athletes/:athleteId/plan
- GET /athletes/:athleteId/context
- POST /athletes/:athleteId/plan/adopt
- GET /analysis
- POST /followup
- POST /feedback

## connectors.ts
- GET /
- POST /:id/sync
- GET /:id/runs
- POST /:id/backfill
- POST /:id/disconnect
- POST /:id/revoke
- GET /:id/authorize
- GET /strava/callback

## core-prediction.ts
- GET /:workoutId

## device-sync.ts
- GET /status
- GET /:provider/authorize
- GET /:provider/callback
- POST /:provider/disconnect
- POST /send

## dev.ts
- GET /preview-athletes

## document-analysis.ts
- GET /
- GET /:id
- POST /
- POST /:id/answers
- POST /:id/link
- DELETE /:id

## engagement.ts
- GET /rhythm

## feed.ts
- GET /news

## flags.ts
- GET /
- GET /admin/definitions
- PUT /admin/definitions/:key
- GET /admin/overrides/:clerkId

## garage.ts
- GET /
- POST /bikes
- PATCH /bikes/:id
- DELETE /bikes/:id
- POST /bikes/:id/photo
- GET /photo/:bikeId/:idx
- GET /catalog
- POST /components
- PATCH /components/:id
- DELETE /components/:id
- GET /upgrade
- POST /test/estimate
- GET /test/compare
- GET /developments
- GET /pro-teams
- POST /sensors
- PATCH /sensors/:id
- DELETE /sensors/:id
- GET /usage
- GET /components/:id/usage
- GET /signals
- GET /components/:id/events
- POST /components/:id/events
- DELETE /events/:eventId
- GET /events/:eventId/photo/:idx
- PUT /sessions/:sessionId/bike
- GET /choices
- PUT /choices

## goals.ts
- GET /
- POST /
- PUT /:id
- DELETE /:id
- GET /:id/events
- POST /proposals/build
- POST /proposals/:id/decision

## health-flow.ts
- GET /overview
- GET /checkin-context
- GET /history
- POST /complaints
- POST /complaints/:id/updates
- POST /resume
- GET /safety-info
- PUT /safety-info

## health.ts
- GET /
- GET /healthz

## hub.ts
- GET /overview
- GET /sources
- GET /consents
- PUT /consents/:provider
- GET /logs
- GET /equipment
- POST /equipment
- PATCH /equipment/:id
- DELETE /equipment/:id
- POST /sync/:id
- POST /sync

## index.ts

## input-center.ts

## insights.ts
- GET /open-loops
- GET /honest

## intel.ts
- GET /meta
- GET /
- GET /:id
- POST /:id/flag

## invitations.ts
- POST /
- GET /
- GET /:token
- POST /:token/accept
- POST /:token/decline
- POST /:id/revoke

## journey.ts
- GET /
- GET /race/:raceId
- POST /items
- POST /media
- PUT /media/:id

## knowledge-admin.ts
- GET /
- POST /items
- PUT /items/:id
- POST /items/:id/publiceer
- POST /items/:id/status
- GET /items/:id/versies
- POST /feedback/:id/afhandelen

## knowledge.ts
- GET /meta
- GET /
- POST /scan
- GET /explain
- GET /bronnen
- POST /feedback

## legal.ts
- GET /status
- GET /:kind
- POST /:kind/accept
- POST /:kind/revoke

## links.ts
- GET /
- DELETE /coach/:coachClerkId
- DELETE /parent/:parentClerkId
- DELETE /as-coach/:athleteClerkId
- DELETE /as-parent/:athleteClerkId
- GET /parents/manage
- GET /parent-reports
- POST /parent-reports/:id/status
- GET /parent/:parentClerkId/messages
- POST /parent/:parentClerkId/messages
- GET /emergency-contacts

## live-location.ts
- GET /group-options
- POST /sessions
- GET /sessions/current
- DELETE /sessions/current
- POST /positions
- GET /friends

## material.ts
- GET /categories
- GET /nudge
- GET /
- POST /analyze
- POST /:id/photo
- GET /photo/:id/:idx

## memory.ts
- POST /context
- GET /context
- GET /follow-ups/due
- POST /follow-ups/:id/answer
- POST /follow-ups/:id/dismiss
- PATCH /context/:id
- DELETE /context/:id

## mental.ts

## nav-settings.ts
- GET /
- PUT /

## notifications.ts
- GET /push/key
- POST /push/subscribe
- POST /push/unsubscribe
- GET /preferences
- PUT /preferences
- GET /
- PATCH /:id/read
- POST /read-batch
- POST /read-all

## nutrition.ts
- GET /
- POST /
- DELETE /:id
- GET /photo/:id/:idx
- POST /:id/photo-advice
- GET /day-analysis
- GET /season-goal
- PUT /season-goal
- GET /fueling-plan
- GET /preferences
- PUT /preferences
- GET /session-targets
- GET /guidance

## onboarding.ts
- GET /missing-data
- POST /missing-data
- GET /state
- PUT /state
- POST /quick-start
- POST /complete-v2
- GET /identity
- POST /coaching-mode
- GET /next-questions
- POST /answer
- POST /skip

## parent.ts
- GET /athletes
- GET /athletes/:athleteId/context
- GET /overview
- GET /athletes/:athleteId/permissions
- PUT /athletes/:athleteId/permissions
- POST /athletes/:athleteId/reports
- GET /athletes/:athleteId/reports
- GET /athletes/:athleteId/messages
- POST /athletes/:athleteId/messages
- GET /reports/for-coach

## passport.ts
- GET /
- GET /ontwikkeling
- POST /waarde
- POST /voorstellen/:id/besluit
- POST /export

## photo-style.ts
- POST /stylize
- POST /decor/clear
- POST /:id/choose
- POST /:id/use-as-decor
- GET /latest

## privacy.ts
- GET /
- PUT /

## race-exports.ts
- GET /:raceId/exports
- POST /:raceId/exports
- GET /:raceId/exports/:exportId/download

## race-points.ts
- GET /:raceId/points
- POST /:raceId/points
- PATCH /:raceId/points/:pointId
- DELETE /:raceId/points/:pointId

## race-rooms.ts
- GET /race-rooms/music
- GET /race-rooms
- POST /race-rooms

## races.ts
- GET /
- GET /insight
- GET /:id/intel
- GET /:id/context
- GET /:id/evaluation
- GET /:id/course
- GET /:id/advice
- GET /:id/dossier
- POST /
- PUT /:id
- PUT /:id/checklist
- DELETE /:id

## release.ts
- POST /errors
- GET /notes
- POST /notes/:id/read
- GET /pilot-status
- POST /pilot-consent
- GET /version-check
- GET /admin/kill-switches
- PUT /admin/kill-switches/:key
- GET /admin/versions
- PUT /admin/versions/:platform
- GET /admin/users
- PUT /admin/users/:clerkId/group
- GET /admin/clubs
- PUT /admin/clubs/:id/group
- GET /admin/errors
- GET /admin/errors/:id
- POST /admin/errors/:id/resolve
- GET /admin/guards
- PUT /admin/guards/:flagKey
- GET /admin/notes
- POST /admin/notes
- POST /admin/notes/:id/publish
- POST /admin/rollback
- GET /admin/operations

## ride-story.ts
- GET /sync-status
- GET /moment

## road-objects.ts
- GET /along-route/:routeId
- GET /session/:importId/stops
- POST /:id/confirm

## route-proposals.ts
- POST /:id/voorstel
- GET /voorstellen
- POST /voorstellen/:id/reageer
- POST /voorstellen/:id/aanpassen

## routes.ts
- GET /
- GET /gedeeld
- GET /geocode
- GET /pace
- GET /:id
- GET /:id/insight
- POST /:id/rejoin
- POST /remarks-preview
- POST /surfaces-preview
- GET /:id/surfaces
- GET /:id/remarks
- GET /:id/pois
- POST /:id/detour-via
- GET /:id/gpx
- GET /:id/tcx
- GET /candidate/:candidateId/gpx
- GET /candidate/:candidateId/tcx
- POST /generate
- POST /generate/options
- POST /
- POST /from-activity
- PUT /:id
- POST /:id/duplicate
- POST /:id/delen
- GET /:id/delen
- DELETE /:id/delen/:shareId
- POST /:id/navigatie-start
- GET /:id/vergelijk
- DELETE /:id

## share.ts
- GET /session/:id
- POST /session/:id/strava

## social.ts
- GET /overview
- POST /follow/:clerkId
- DELETE /follow/:clerkId
- GET /blocks
- POST /blocks/:clerkId
- DELETE /blocks/:clerkId
- POST /reports
- GET /privacy
- PUT /privacy
- GET /profile/:clerkId
- POST /contacts/match
- GET /friends
- GET /requests
- GET /search
- POST /requests
- POST /requests/:id/respond
- POST /friends/:clerkId/buddy
- DELETE /friends/:clerkId
- GET /feed
- GET /circle-feed
- GET /suggestion
- GET /proposals
- POST /proposals
- POST /proposals/:id/respond
- GET /team
- PUT /team

## sparki-world.ts
- GET /feed
- GET /athletes/:slug
- POST /athletes/:id/follow
- DELETE /athletes/:id/follow
- POST /posts/:id/like
- GET /posts/:id/comments
- POST /posts/:id/view
- POST /posts/:id/save
- POST /posts/:id/share
- GET /saved
- GET /recommended
- GET /heroes
- POST /posts/:id/comments

## sprints.ts
- GET /route/:id
- POST /route/:id/rescan
- POST /result
- GET /season
- POST /place
- POST /result/:id/share

## state.ts
- GET /

## storage.ts

## support.ts
- POST /helpdesk/ask
- POST /helpdesk/:id/feedback
- GET /artikelen
- GET /tickets
- GET /tickets/:id
- POST /tickets/:id/messages
- GET /beheer/tickets
- GET /beheer/groepen
- GET /beheer/tickets/:id
- PATCH /beheer/tickets/:id
- POST /beheer/tickets/:id/notitie
- POST /beheer/tickets/:id/concept
- POST /beheer/tickets/:id/verzend
- POST /beheer/tickets/:id/samenvoegen
- GET /beheer/storingen
- POST /beheer/storingen
- PATCH /beheer/storingen/:id
- GET /beheer/artikelen
- POST /beheer/artikelen
- POST /beheer/tickets/:id/naar-artikel
- PATCH /beheer/artikelen/:id
- POST /beheer/artikelen/:id/publiceer

## telemetry.ts
- POST /

## training-plan.ts
- GET /
- POST /generate
- POST /regenerate
- POST /adapt
- POST /pause
- POST /resume
- DELETE /

## voice.ts
- GET /

## volgauto.ts
- GET /:id/volgauto
- POST /:id/volgauto
- DELETE /:id/volgauto
- POST /:id/volgauto/rejoin
- POST /:id/volgauto/position
- GET /:id/volgauto/positions
- POST /:id/volgauto/reports
- GET /:id/volgauto/reports

## weather.ts
- GET /home

## webhooks.ts
- GET /strava
- POST /strava
- POST /garmin
- POST /wahoo

## world-social.ts
- POST /items
- PUT /items/:id
- DELETE /items/:id
- GET /items/mine
- GET /feed
- GET /items/:id
- GET /blocks
- POST /blocks
- POST /reports
- GET /moderation
- GET /prefs
- PUT /prefs

