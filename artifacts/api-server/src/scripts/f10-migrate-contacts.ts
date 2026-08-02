// SPARKI_BUILD_01 F10 (PD-3) — migratiescript: bestaande persoonsadministraties
// op contactniveau brengen ZONDER iets kwijt te raken.
//
// BINDEND (F10-document): dit script draait EERST in --dry-run en levert een
// rapport aan René voordat er wordt samengevoegd. De echte run gebeurt pas na
// akkoord. Samenvoegen mag UITSLUITEND op aantoonbare identiteit (clerkId of
// exact genormaliseerd e-mail). Bij twijfel: contact_merge_review, NOOIT
// automatisch samenvoegen.
//
// Idempotent: elke user_profiles-rij levert precies één contact (clerkId-anker,
// UNIQUE), en relaties worden per (from,to,type) actief-uniek ontdubbeld.
//
// Gebruik:
//   pnpm --filter @workspace/api-server run f10:migrate -- --dry-run
//   pnpm --filter @workspace/api-server run f10:migrate            (echte run)

import { and, eq, isNull, sql } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  coachingProfilesTable,
  clubMembersTable,
  coachAthleteLinksTable,
  parentAthleteLinksTable,
  trainerClientsTable,
  clientAthleteLinksTable,
  billingPartiesTable,
  emergencyContactsTable,
  invitationsTable,
  trainerGroupsTable,
  trainerGroupMembersTable,
  clubTeamsTable,
  clubTeamMembersTable,
  clubGroupsTable,
  clubGroupMembersTable,
  contactsTable,
  contactRelationsTable,
  contactMergeReviewTable,
  type ContactKind,
  type ContactRelationType,
} from "@workspace/db";
import {
  findOrCreateContact,
  startRelation,
  normalizeEmail,
} from "../lib/contacts";

const DRY = process.argv.includes("--dry-run");

type Report = Record<
  string,
  {
    identities: number;
    contactsCreatedOrLinked: number;
    likelyDuplicates: number;
    needsReview: number;
    relations: number;
    notes: string[];
  }
>;

function bucket(report: Report, key: string) {
  if (!report[key]) {
    report[key] = {
      identities: 0,
      contactsCreatedOrLinked: 0,
      likelyDuplicates: 0,
      needsReview: 0,
      relations: 0,
      notes: [],
    };
  }
  return report[key]!;
}

// Map van clerkId → contact-id, opgebouwd tijdens de user_profiles-fase zodat
// de link-tabellen (die op clerkId werken) direct kunnen verwijzen.
const contactByClerk = new Map<string, number>();

// Per club één organisatie-contact (type "bedrijf"). Gedeeld tussen de
// club_members-, club_teams- en club_groups-bronnen zodat lidmaatschappen naar
// hetzelfde organisatie-anker verwijzen (geen dubbele org-contacten per club).
const clubOrgContact = new Map<number, number>();

type MigTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function getOrCreateClubOrg(tx: MigTx, clubId: number): Promise<number> {
  const cached = clubOrgContact.get(clubId);
  if (cached != null) return cached;
  const org = await findOrCreateContact(
    {
      displayName: `Club #${clubId}`,
      kindTags: ["bedrijf"],
      sourceNote: `organisatie-anker club ${clubId}`,
      source: "clubs",
      sourceId: String(clubId),
    },
    tx,
  );
  const orgId = "contact" in org ? org.contact.id : org.existing.id;
  clubOrgContact.set(clubId, orgId);
  return orgId;
}

// Club-clubrol → contacttag/relatie afleiding.
const CLUB_ROLE_TO_KIND: Record<string, ContactKind | null> = {
  owner: null,
  admin: null,
  hoofdtrainer: "hoofdtrainer",
  trainer: "trainer",
  assistent: "vrijwilliger",
  teammanager: "teammanager",
  ploegleider: "ploegleider",
  mechanieker: "mechanieker",
  member: "sporter",
  parent: "ouder_verzorger",
  vrijwilliger: "vrijwilliger",
  alleen_lezen: null,
  soigneur: "soigneur",
  medical_staff: "medical_staff",
};

// Clubrollen die stafrollen zijn (staf_van via lid_van's org-contact — hier
// modelleren we lidmaatschap als lid_van naar een organisatie-contact; voor
// stafrollen leggen we naast lid_van óók staf_van vast).
const CLUB_STAFF_ROLES = new Set([
  "hoofdtrainer",
  "trainer",
  "teammanager",
  "ploegleider",
  "mechanieker",
  "soigneur",
  "medical_staff",
  "assistent",
]);

async function main(): Promise<void> {
  const report: Report = {};

  // Wrap alles in één transactie bij een echte run, zodat een fout niets half
  // achterlaat. Bij dry-run rollen we bewust terug.
  await db.transaction(async (tx) => {
    // ── Bron 1: user_profiles ⇒ contact (clerkId-anker) ─────────────────────
    const up = bucket(report, "user_profiles");
    const users = await tx
      .select({
        clerkId: userProfilesTable.clerkId,
        email: userProfilesTable.email,
        displayName: userProfilesTable.displayName,
        roles: userProfilesTable.roles,
      })
      .from(userProfilesTable);
    up.identities = users.length;

    // Rollen op user_profiles → contacttypen (athlete/coach/parent/nutrition).
    const ROLE_TO_KIND: Record<string, ContactKind | null> = {
      athlete: "sporter",
      coach: "trainer",
      parent: "ouder_verzorger",
      nutrition_specialist: "nutrition_specialist",
    };

    for (const u of users) {
      const kinds: ContactKind[] = [];
      for (const r of u.roles ?? []) {
        const k = ROLE_TO_KIND[r];
        if (k) kinds.push(k);
      }
      const r = await findOrCreateContact(
        {
          clerkId: u.clerkId,
          email: u.email,
          displayName: u.displayName ?? u.email ?? u.clerkId,
          kindTags: kinds,
          sourceNote: "gemigreerd uit user_profiles",
          source: "user_profiles",
          sourceId: u.clerkId,
        },
        tx,
      );
      if (r.status === "duplicate_rejected") {
        // Kan hier eigenlijk niet: clerkId is uniek. Log defensief.
        up.likelyDuplicates++;
        contactByClerk.set(u.clerkId, r.existing.id);
      } else {
        up.contactsCreatedOrLinked++;
        contactByClerk.set(u.clerkId, r.contact.id);
        if (r.status === "created_needs_review") up.needsReview++;
      }
    }

    // ── Bron 2: athlete_profiles ⇒ tag "sporter" ────────────────────────────
    const ap = bucket(report, "athlete_profiles");
    const athletes = await tx
      .select({ clerkId: athleteProfilesTable.clerkId })
      .from(athleteProfilesTable);
    ap.identities = athletes.length;
    for (const a of athletes) {
      const cid = contactByClerk.get(a.clerkId);
      if (cid == null) {
        ap.notes.push(`athlete_profiles ${a.clerkId} zonder user_profiles-contact`);
        continue;
      }
      await addKinds(tx, cid, ["sporter"]);
      ap.contactsCreatedOrLinked++;
    }

    // ── Bron 3: coaching_profiles ⇒ tag "trainer" ───────────────────────────
    const cp = bucket(report, "coaching_profiles");
    const coaches = await tx
      .select({ clerkId: coachingProfilesTable.clerkId })
      .from(coachingProfilesTable);
    cp.identities = coaches.length;
    for (const c of coaches) {
      const cid = contactByClerk.get(c.clerkId);
      if (cid == null) {
        cp.notes.push(`coaching_profiles ${c.clerkId} zonder user_profiles-contact`);
        continue;
      }
      await addKinds(tx, cid, ["trainer"]);
      cp.contactsCreatedOrLinked++;
    }

    // ── Bron 4: club_members ⇒ tag uit clubrol + relatie lid_van/staf_van ────
    // De clubrelatie loopt naar een organisatie-contact per club. We maken (of
    // hergebruiken) per club één "bedrijf"-contact als organisatie-anker.
    const cm = bucket(report, "club_members");
    const members = await tx
      .select({
        clubId: clubMembersTable.clubId,
        clerkId: clubMembersTable.clerkId,
        role: clubMembersTable.role,
        joinedAt: clubMembersTable.joinedAt,
        endedAt: clubMembersTable.endedAt,
      })
      .from(clubMembersTable);
    cm.identities = new Set(members.map((m) => m.clerkId)).size;
    for (const m of members) {
      const cid = contactByClerk.get(m.clerkId);
      if (cid == null) {
        cm.notes.push(`club_members ${m.clerkId} zonder user_profiles-contact`);
        continue;
      }
      const kind = CLUB_ROLE_TO_KIND[m.role];
      if (kind) await addKinds(tx, cid, [kind]);
      cm.contactsCreatedOrLinked++;

      // Organisatie-contact per club (type bedrijf), gedeeld tussen bronnen.
      const orgId = await getOrCreateClubOrg(tx, m.clubId);
      // lid_van (met start uit joinedAt, einde uit endedAt).
      const rel = await startRelation(
        {
          fromContactId: cid,
          toContactId: orgId,
          relationType: "lid_van",
          startedAt: m.joinedAt ?? undefined,
          sourceNote: "club_members",
        },
        tx,
      );
      if (m.endedAt) {
        await tx
          .update(contactRelationsTable)
          .set({ endedAt: m.endedAt })
          .where(eq(contactRelationsTable.id, rel.id));
      }
      cm.relations++;
      // staf_van voor stafrollen.
      if (CLUB_STAFF_ROLES.has(m.role)) {
        await startRelation(
          {
            fromContactId: cid,
            toContactId: orgId,
            relationType: "staf_van",
            startedAt: m.joinedAt ?? undefined,
            sourceNote: `club_members rol ${m.role}`,
          },
          tx,
        );
        cm.relations++;
      }
    }

    // ── Bron 5: coach_athlete_links ⇒ relatie trainer_van ────────────────────
    const cal = bucket(report, "coach_athlete_links");
    const coachLinks = await tx
      .select({
        coachClerkId: coachAthleteLinksTable.coachClerkId,
        athleteClerkId: coachAthleteLinksTable.athleteClerkId,
        startedAt: coachAthleteLinksTable.startedAt,
        endedAt: coachAthleteLinksTable.endedAt,
      })
      .from(coachAthleteLinksTable);
    cal.identities = coachLinks.length;
    for (const l of coachLinks) {
      const from = contactByClerk.get(l.coachClerkId);
      const to = contactByClerk.get(l.athleteClerkId);
      if (from == null || to == null) {
        cal.notes.push(`coach_athlete_link ${l.coachClerkId}→${l.athleteClerkId} mist contact`);
        continue;
      }
      const rel = await startRelation(
        { fromContactId: from, toContactId: to, relationType: "trainer_van", startedAt: l.startedAt ?? undefined, sourceNote: "coach_athlete_links" },
        tx,
      );
      if (l.endedAt) {
        await tx.update(contactRelationsTable).set({ endedAt: l.endedAt }).where(eq(contactRelationsTable.id, rel.id));
      }
      cal.relations++;
      cal.contactsCreatedOrLinked++;
    }

    // ── Bron 6: parent_athlete_links ⇒ relatie ouder_van ─────────────────────
    const pal = bucket(report, "parent_athlete_links");
    const parentLinks = await tx
      .select({
        parentClerkId: parentAthleteLinksTable.parentClerkId,
        athleteClerkId: parentAthleteLinksTable.athleteClerkId,
        startedAt: parentAthleteLinksTable.startedAt,
        endedAt: parentAthleteLinksTable.endedAt,
      })
      .from(parentAthleteLinksTable);
    pal.identities = parentLinks.length;
    for (const l of parentLinks) {
      const from = contactByClerk.get(l.parentClerkId);
      const to = contactByClerk.get(l.athleteClerkId);
      if (from == null || to == null) {
        pal.notes.push(`parent_athlete_link ${l.parentClerkId}→${l.athleteClerkId} mist contact`);
        continue;
      }
      await addKinds(tx, from, ["ouder_verzorger"]);
      const rel = await startRelation(
        { fromContactId: from, toContactId: to, relationType: "ouder_van", startedAt: l.startedAt ?? undefined, sourceNote: "parent_athlete_links" },
        tx,
      );
      if (l.endedAt) {
        await tx.update(contactRelationsTable).set({ endedAt: l.endedAt }).where(eq(contactRelationsTable.id, rel.id));
      }
      pal.relations++;
      pal.contactsCreatedOrLinked++;
    }

    // ── Bron 7: trainer_clients ⇒ contact (klant) + relatie klant_voor ───────
    // Zonder clerkId: match alleen op exact genormaliseerd e-mail; twijfel ⇒
    // contact_merge_review. clientClerkId (indien aanwezig) is het anker.
    const tc = bucket(report, "trainer_clients");
    const clients = await tx
      .select({
        id: trainerClientsTable.id,
        trainerClerkId: trainerClientsTable.trainerClerkId,
        name: trainerClientsTable.name,
        email: trainerClientsTable.email,
        phone: trainerClientsTable.phone,
        clientClerkId: trainerClientsTable.clientClerkId,
        createdAt: trainerClientsTable.createdAt,
      })
      .from(trainerClientsTable);
    tc.identities = clients.length;
    // trainer_clients.id → contact-id van de klant, nodig voor client_athlete_links.
    const clientContactById = new Map<number, number>();
    for (const cl of clients) {
      const r = await findOrCreateContact(
        {
          clerkId: cl.clientClerkId,
          email: cl.email,
          displayName: cl.name,
          phone: cl.phone,
          kindTags: ["klant"],
          sourceNote: "gemigreerd uit trainer_clients",
          source: "trainer_clients",
          sourceId: String(cl.id),
        },
        tx,
      );
      let clientContactId: number;
      if (r.status === "duplicate_rejected") {
        tc.likelyDuplicates++;
        clientContactId = r.existing.id;
        await addKinds(tx, clientContactId, ["klant"]);
      } else {
        clientContactId = r.contact.id;
        tc.contactsCreatedOrLinked++;
        if (r.status === "created_needs_review") tc.needsReview++;
      }
      // Verwijs de bron naar het contact (geen duplicatie).
      await tx.update(trainerClientsTable).set({ contactId: clientContactId }).where(eq(trainerClientsTable.id, cl.id));
      clientContactById.set(cl.id, clientContactId);
      // Relatie klant_voor naar het trainer-contact.
      const trainerContact = contactByClerk.get(cl.trainerClerkId);
      if (trainerContact != null) {
        await startRelation(
          { fromContactId: clientContactId, toContactId: trainerContact, relationType: "klant_voor", startedAt: cl.createdAt ?? undefined, sourceNote: "trainer_clients" },
          tx,
        );
        tc.relations++;
      }
    }

    // ── Bron 7b: client_athlete_links ⇒ relatie klant_voor (klant → sporter) ─
    // DIT is de kern: welke sporter hoort bij welke klant. Zonder deze relatie
    // is "klant+sporter = één contact, twee relaties" niet aantoonbaar. De
    // klant kan een ander zijn dan de sporter (ouder betaalt kind), of dezelfde
    // persoon (sporter is zelf klant) — in dat laatste geval draagt één contact
    // twee relaties (klant_voor naar de trainer + de sporter-kant), nooit een
    // samengevoegde entiteit.
    const cathl = bucket(report, "client_athlete_links");
    const clientLinks = await tx
      .select({
        id: clientAthleteLinksTable.id,
        clientId: clientAthleteLinksTable.clientId,
        athleteClerkId: clientAthleteLinksTable.athleteClerkId,
        relationType: clientAthleteLinksTable.relationType,
        startedAt: clientAthleteLinksTable.startedAt,
        endedAt: clientAthleteLinksTable.endedAt,
      })
      .from(clientAthleteLinksTable);
    cathl.identities = clientLinks.length;
    for (const l of clientLinks) {
      const klantContact = clientContactById.get(l.clientId);
      const sporterContact = contactByClerk.get(l.athleteClerkId);
      if (klantContact == null || sporterContact == null) {
        cathl.notes.push(
          `client_athlete_link ${l.id} (client ${l.clientId} → sporter ${l.athleteClerkId}) mist contact`,
        );
        continue;
      }
      // De sporter is een sporter (tag), de klant blijft klant (al getagd).
      await addKinds(tx, sporterContact, ["sporter"]);
      const rel = await startRelation(
        {
          fromContactId: klantContact,
          toContactId: sporterContact,
          relationType: "klant_voor",
          startedAt: l.startedAt ?? undefined,
          sourceNote: `client_athlete_links (relatie ${l.relationType})`,
        },
        tx,
      );
      if (l.endedAt) {
        await tx.update(contactRelationsTable).set({ endedAt: l.endedAt }).where(eq(contactRelationsTable.id, rel.id));
      }
      cathl.relations++;
      cathl.contactsCreatedOrLinked++;
    }

    // ── Bron 8: billing_parties ⇒ contact (betaler) + relatie betaler_voor ───
    const bp = bucket(report, "billing_parties");
    const parties = await tx
      .select({
        id: billingPartiesTable.id,
        clientId: billingPartiesTable.clientId,
        name: billingPartiesTable.name,
        email: billingPartiesTable.email,
        startedAt: billingPartiesTable.startedAt,
        endedAt: billingPartiesTable.endedAt,
      })
      .from(billingPartiesTable);
    bp.identities = parties.length;
    for (const p of parties) {
      const r = await findOrCreateContact(
        {
          email: p.email,
          displayName: p.name,
          kindTags: ["betaler"],
          sourceNote: "gemigreerd uit billing_parties",
          source: "billing_parties",
          sourceId: String(p.id),
        },
        tx,
      );
      let payerContactId: number;
      if (r.status === "duplicate_rejected") {
        bp.likelyDuplicates++;
        payerContactId = r.existing.id;
        await addKinds(tx, payerContactId, ["betaler"]);
      } else {
        payerContactId = r.contact.id;
        bp.contactsCreatedOrLinked++;
        if (r.status === "created_needs_review") bp.needsReview++;
      }
      await tx.update(billingPartiesTable).set({ contactId: payerContactId }).where(eq(billingPartiesTable.id, p.id));
      // Betaler_voor naar het klant-contact (via trainer_clients.contactId).
      const [client] = await tx
        .select({ contactId: trainerClientsTable.contactId })
        .from(trainerClientsTable)
        .where(eq(trainerClientsTable.id, p.clientId));
      if (client?.contactId != null) {
        const rel = await startRelation(
          { fromContactId: payerContactId, toContactId: client.contactId, relationType: "betaler_voor", startedAt: p.startedAt ?? undefined, sourceNote: "billing_parties" },
          tx,
        );
        if (p.endedAt) {
          await tx.update(contactRelationsTable).set({ endedAt: p.endedAt }).where(eq(contactRelationsTable.id, rel.id));
        }
        bp.relations++;
      }
    }

    // ── Bron 9: emergency_contacts ⇒ contact (noodcontact) + noodcontact_van ─
    const ec = bucket(report, "emergency_contacts");
    const emergencies = await tx
      .select({
        id: emergencyContactsTable.id,
        athleteClerkId: emergencyContactsTable.athleteClerkId,
        name: emergencyContactsTable.name,
        phone: emergencyContactsTable.phone,
        createdAt: emergencyContactsTable.createdAt,
      })
      .from(emergencyContactsTable);
    ec.identities = emergencies.length;
    for (const e of emergencies) {
      const r = await findOrCreateContact(
        {
          displayName: e.name,
          phone: e.phone,
          kindTags: ["noodcontact"],
          sourceNote: "gemigreerd uit emergency_contacts",
          source: "emergency_contacts",
          sourceId: String(e.id),
        },
        tx,
      );
      let ncId: number;
      if (r.status === "duplicate_rejected") {
        ec.likelyDuplicates++;
        ncId = r.existing.id;
      } else {
        ncId = r.contact.id;
        ec.contactsCreatedOrLinked++;
        if (r.status === "created_needs_review") ec.needsReview++;
      }
      await tx.update(emergencyContactsTable).set({ contactId: ncId }).where(eq(emergencyContactsTable.id, e.id));
      const athleteContact = contactByClerk.get(e.athleteClerkId);
      if (athleteContact != null) {
        await startRelation(
          { fromContactId: ncId, toContactId: athleteContact, relationType: "noodcontact_van", startedAt: e.createdAt ?? undefined, sourceNote: "emergency_contacts" },
          tx,
        );
        ec.relations++;
      }
    }

    // ── Bron 10: invitations ⇒ registratie (geen contact, wel gedekt) ────────
    // Uitnodigingen zijn nog geen identiteiten (er is geen persoon aangemaakt).
    // We nemen ze WEL op in het rapport zodat geen bron stilzwijgend verdwijnt:
    // een uitnodiging met een e-mail die al bij een bestaand contact hoort is
    // gedekt; een onbekend e-mail wordt bewust NIET als contact aangemaakt
    // (fail-closed: pas een echt account/acceptatie maakt een identiteit).
    const inv = bucket(report, "invitations");
    const invites = await tx
      .select({ id: invitationsTable.id, email: invitationsTable.email })
      .from(invitationsTable);
    inv.identities = invites.length;
    for (const i of invites) {
      const em = normalizeEmail(i.email);
      if (!em) {
        inv.notes.push(`invitation ${i.id} zonder e-mail (rol-only, geen identiteit)`);
        continue;
      }
      const [match] = await tx
        .select({ id: contactsTable.id })
        .from(contactsTable)
        .where(eq(contactsTable.primaryEmail, em));
      if (match) {
        inv.contactsCreatedOrLinked++;
        inv.notes.push(`invitation ${i.id} gedekt door bestaand contact #${match.id}`);
      } else {
        inv.notes.push(`invitation ${i.id} (${em}) nog geen identiteit — bewust geen contact aangemaakt`);
      }
    }

    // ── Bron 11: trainer_groups / trainer_group_members ─────────────────────
    // Sportergroepen van de zelfstandige trainer zijn ORGANISATIE/presentatie,
    // géén rechtenbron. We modelleren de groep als een organisatie-contact
    // (type "bedrijf") en het lidmaatschap als lid_van (start uit added_at).
    // Geen nieuwe relatietypen; groepen leiden nooit rechten af.
    const tg = bucket(report, "trainer_groups");
    const groups = await tx
      .select({ id: trainerGroupsTable.id, name: trainerGroupsTable.name, trainerClerkId: trainerGroupsTable.trainerClerkId })
      .from(trainerGroupsTable);
    tg.identities = groups.length;
    const trainerGroupOrg = new Map<number, number>();
    for (const g of groups) {
      const org = await findOrCreateContact(
        {
          displayName: `Trainersgroep #${g.id} (${g.name})`,
          kindTags: ["bedrijf"],
          sourceNote: `organisatie-anker trainer_groups ${g.id}`,
          source: "trainer_groups",
          sourceId: String(g.id),
        },
        tx,
      );
      const orgId = "contact" in org ? org.contact.id : org.existing.id;
      trainerGroupOrg.set(g.id, orgId);
      tg.contactsCreatedOrLinked++;
    }
    const tgm = bucket(report, "trainer_group_members");
    const groupMembers = await tx
      .select({
        id: trainerGroupMembersTable.id,
        groupId: trainerGroupMembersTable.groupId,
        athleteClerkId: trainerGroupMembersTable.athleteClerkId,
        addedAt: trainerGroupMembersTable.addedAt,
      })
      .from(trainerGroupMembersTable);
    tgm.identities = groupMembers.length;
    for (const gm of groupMembers) {
      const orgId = trainerGroupOrg.get(gm.groupId);
      const sporter = contactByClerk.get(gm.athleteClerkId);
      if (orgId == null || sporter == null) {
        tgm.notes.push(`trainer_group_member ${gm.id} mist contact (groep ${gm.groupId} / sporter ${gm.athleteClerkId})`);
        continue;
      }
      await addKinds(tx, sporter, ["sporter"]);
      await startRelation(
        { fromContactId: sporter, toContactId: orgId, relationType: "lid_van", startedAt: gm.addedAt ?? undefined, sourceNote: "trainer_group_members" },
        tx,
      );
      tgm.relations++;
      tgm.contactsCreatedOrLinked++;
    }

    // ── Bron 12: club_teams / club_team_members ──────────────────────────────
    // Teams horen bij een club (organisatie-anker via getOrCreateClubOrg). Het
    // teamlidmaatschap is lid_van naar het club-organisatie-contact. We maken
    // GEEN apart contact per team (dat zou een tweede organisatielijst worden);
    // de club is het organisatie-anker. endedAt uit de bron blijft historisch.
    const ct = bucket(report, "club_teams");
    const teams = await tx
      .select({ id: clubTeamsTable.id, clubId: clubTeamsTable.clubId })
      .from(clubTeamsTable);
    ct.identities = teams.length;
    const teamClub = new Map<number, number>();
    for (const t of teams) {
      teamClub.set(t.id, t.clubId);
      // Zorg dat het club-organisatie-contact bestaat (ook als er geen leden zijn).
      await getOrCreateClubOrg(tx, t.clubId);
      ct.contactsCreatedOrLinked++;
    }
    const ctm = bucket(report, "club_team_members");
    const teamMembers = await tx
      .select({
        id: clubTeamMembersTable.id,
        teamId: clubTeamMembersTable.teamId,
        clerkId: clubTeamMembersTable.clerkId,
        endedAt: clubTeamMembersTable.endedAt,
        createdAt: clubTeamMembersTable.createdAt,
      })
      .from(clubTeamMembersTable);
    ctm.identities = teamMembers.length;
    for (const tm of teamMembers) {
      const clubId = teamClub.get(tm.teamId);
      const person = contactByClerk.get(tm.clerkId);
      if (clubId == null || person == null) {
        ctm.notes.push(`club_team_member ${tm.id} mist contact (team ${tm.teamId} / ${tm.clerkId})`);
        continue;
      }
      const orgId = await getOrCreateClubOrg(tx, clubId);
      const rel = await startRelation(
        { fromContactId: person, toContactId: orgId, relationType: "lid_van", startedAt: tm.createdAt ?? undefined, sourceNote: `club_team_members (team ${tm.teamId})` },
        tx,
      );
      if (tm.endedAt) {
        await tx.update(contactRelationsTable).set({ endedAt: tm.endedAt }).where(eq(contactRelationsTable.id, rel.id));
      }
      ctm.relations++;
      ctm.contactsCreatedOrLinked++;
    }

    // ── Bron 13: club_groups / club_group_members ────────────────────────────
    const cg = bucket(report, "club_groups");
    const clubGroups = await tx
      .select({ id: clubGroupsTable.id, clubId: clubGroupsTable.clubId })
      .from(clubGroupsTable);
    cg.identities = clubGroups.length;
    const groupClub = new Map<number, number>();
    for (const g of clubGroups) {
      groupClub.set(g.id, g.clubId);
      await getOrCreateClubOrg(tx, g.clubId);
      cg.contactsCreatedOrLinked++;
    }
    const cgm = bucket(report, "club_group_members");
    const clubGroupMembers = await tx
      .select({
        id: clubGroupMembersTable.id,
        groupId: clubGroupMembersTable.groupId,
        clerkId: clubGroupMembersTable.clerkId,
        endedAt: clubGroupMembersTable.endedAt,
        createdAt: clubGroupMembersTable.createdAt,
      })
      .from(clubGroupMembersTable);
    cgm.identities = clubGroupMembers.length;
    for (const gm of clubGroupMembers) {
      const clubId = groupClub.get(gm.groupId);
      const person = contactByClerk.get(gm.clerkId);
      if (clubId == null || person == null) {
        cgm.notes.push(`club_group_member ${gm.id} mist contact (groep ${gm.groupId} / ${gm.clerkId})`);
        continue;
      }
      const orgId = await getOrCreateClubOrg(tx, clubId);
      const rel = await startRelation(
        { fromContactId: person, toContactId: orgId, relationType: "lid_van", startedAt: gm.createdAt ?? undefined, sourceNote: `club_group_members (groep ${gm.groupId})` },
        tx,
      );
      if (gm.endedAt) {
        await tx.update(contactRelationsTable).set({ endedAt: gm.endedAt }).where(eq(contactRelationsTable.id, rel.id));
      }
      cgm.relations++;
      cgm.contactsCreatedOrLinked++;
    }

    if (DRY) {
      // Dry-run: bewust terugrollen zodat de dev-DB ongewijzigd blijft.
      throw new DryRunRollback();
    }
  }).catch((err) => {
    if (err instanceof DryRunRollback) return; // verwacht bij dry-run
    throw err;
  });

  printReport(report);
  await pool.end();
  process.exit(0);
}

class DryRunRollback extends Error {}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function addKinds(tx: Tx, contactId: number, kinds: ContactKind[]) {
  const [c] = await tx.select({ kindTags: contactsTable.kindTags }).from(contactsTable).where(eq(contactsTable.id, contactId));
  if (!c) return;
  const set = new Set(c.kindTags);
  let changed = false;
  for (const k of kinds) if (!set.has(k)) { set.add(k); changed = true; }
  if (changed) {
    await tx.update(contactsTable).set({ kindTags: Array.from(set), updatedAt: new Date() }).where(eq(contactsTable.id, contactId));
  }
}

function printReport(report: Report) {
  const mode = DRY ? "DRY-RUN (geen wijzigingen bewaard)" : "ECHTE RUN";
  console.log(`\n=== F10 contactmigratie — ${mode} ===\n`);
  let totalIdentities = 0;
  let totalContacts = 0;
  let totalDup = 0;
  let totalReview = 0;
  let totalRel = 0;
  for (const [src, s] of Object.entries(report)) {
    totalIdentities += s.identities;
    totalContacts += s.contactsCreatedOrLinked;
    totalDup += s.likelyDuplicates;
    totalReview += s.needsReview;
    totalRel += s.relations;
    console.log(`Bron: ${src}`);
    console.log(`  identiteiten:                 ${s.identities}`);
    console.log(`  contacten aangemaakt/gekoppeld: ${s.contactsCreatedOrLinked}`);
    console.log(`  vermoedelijke duplicaten:     ${s.likelyDuplicates}`);
    console.log(`  twijfelgevallen (review):     ${s.needsReview}`);
    console.log(`  relaties:                     ${s.relations}`);
    for (const n of s.notes.slice(0, 20)) console.log(`    · ${n}`);
    if (s.notes.length > 20) console.log(`    · … +${s.notes.length - 20} meer`);
    console.log("");
  }
  console.log("--- Totalen ---");
  console.log(`  identiteiten:              ${totalIdentities}`);
  console.log(`  contacten:                 ${totalContacts}`);
  console.log(`  vermoedelijke duplicaten:  ${totalDup}`);
  console.log(`  twijfelgevallen:           ${totalReview}`);
  console.log(`  relaties:                  ${totalRel}`);
  console.log("");
}

main().catch(async (err) => {
  console.error(err);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});

// Hint voor de tsc/bundler dat we deze imports bewust hebben (defensief).
void and; void isNull; void sql; void contactMergeReviewTable;
