# 004 — Home is modeled as Floors → Rooms, with Errands as the location-less fallback

**Status:** Accepted

**Context.** The v9 wall is a floor plan. Today the model has only a free-text
`task.area` string, grouped ad-hoc (the seed even spells three different bathrooms
all as `"Bath"`). The real home is ~12 Rooms across 3 Floors.

**Decision.** Replace free-text `area` with a **configured spatial model**:
**Home → Floors → Rooms**. Each Room has a name, icon, and floor-plan slot and
belongs to one Floor; the wall shows **one Floor at a time**. A Task belongs to **at
most one Room**; a Task with **no Room is an Errand** — location-less, floor-less,
collected into a single synthesized catch-all tile. Errand is the zero/fallback
state, so there is **no built-in default Room**. Floors and Rooms are **configured
instance data** (seed + a future settings page), never derived from `area` strings.

**Why.** A hand-authored floor plan needs a chosen icon and position per Room — it
can't be inferred from free text. ~12 Rooms won't fit one readable grid, forcing
one-Floor-at-a-time. Making "no Room" a first-class **Errand** removes the need for
an orphan-catching default Room (un-placed simply *is* an Errand).

**Consequence.** Schema change (`area` string → Room reference + Floor + Errand
flag) and a seed migration; a new **settings page** to manage Floors/Rooms; and the
house-wide [[Next Thing]] can sit on a Floor that isn't currently shown, so wall
navigation must be able to point **across Floors** ("Start here" + the wake-to-that-
Floor rule).
