import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Image, Linking, Pressable, RefreshControl, SafeAreaView, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';

const CLUB = {
  id: 'cyp',
  name: 'CYP Poker',
  api: 'https://development.cyp-poker.pages.dev',
  colours: { bg: '#061426', panel: '#0d2745', raised: '#12365d', gold: '#efc250', blue: '#2788e7', text: '#fff', muted: '#a9bfd6' },
} as const;

type Tab = 'Home' | 'Games' | 'Leagues' | 'Players' | 'Results';
type TournamentPlayer = { name: string; finish?: number; winnings?: number };
type Tournament = { id?: number; code?: string; name?: string; typeLabel?: string; date?: string; winner?: string; entries?: number; prizePool?: number; buyIn?: number; startingStack?: number; paidPlaces?: number; players?: TournamentPlayer[] };
type LeaguePlayer = { name: string; played?: number; wins?: number; points?: number };
type League = { name?: string; gamesPlayed?: number; totalGames?: number; players?: LeaguePlayer[] };
type UpcomingGame = { date?: string; time?: string; details?: string; status?: string };
type Data = {
  homepage: { nextTournament?: UpcomingGame; nextLeagues?: Record<string, UpcomingGame> };
  tournaments: Tournament[];
  leagues: Record<string, League>;
  players: string[];
};
const empty: Data = { homepage: {}, tournaments: [], leagues: {}, players: [] };

async function get<T>(path: string): Promise<T> {
  const response = await fetch(CLUB.api + path);
  if (!response.ok) throw new Error(String(response.status));
  return response.json() as Promise<T>;
}

async function loadData(): Promise<Data> {
  const [homepage, history, leagueData, playerData] = await Promise.all([
    get<Data['homepage']>('/api/public/homepage'),
    get<{ tournaments?: Tournament[] }>('/api/public/tournaments'),
    get<{ leagues?: Record<string, League> }>('/api/public/leagues'),
    get<{ players?: string[] }>('/api/public/players'),
  ]);
  return { homepage, tournaments: history.tournaments ?? [], leagues: leagueData.leagues ?? {}, players: playerData.players ?? [] };
}

const money = (value?: number) => `£${Number(value ?? 0).toLocaleString('en-GB')}`;
const cleanText = (value?: string) => String(value ?? '').replace(/Â£/g, '£');
function date(value?: string) {
  if (!value) return 'Date to be confirmed';
  const parsed = new Date(value + 'T12:00:00');
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
function Card({ children, gold = false }: { children: React.ReactNode; gold?: boolean }) {
  return <View style={[s.card, gold && s.goldCard]}>{children}</View>;
}
function Heading({ title, action }: { title: string; action?: string }) {
  return <View style={s.heading}><Text style={s.headingText}>{title}</Text>{action && <Text style={s.action}>{action}</Text>}</View>;
}
function Title({ title, subtitle }: { title: string; subtitle: string }) {
  return <View style={s.titleWrap}><Text style={s.title}>{title}</Text><Text style={s.subtitle}>{subtitle}</Text></View>;
}

function Home({ data, go }: { data: Data; go: (tab: Tab) => void }) {
  const next = data.homepage.nextTournament;
  const nextLeagues = Object.entries(data.homepage.nextLeagues ?? {}).filter(([, game]) => game?.status !== 'tbc' && (game?.date || game?.details));
  const latest = data.tournaments[0];
  const leagues = Object.entries(data.leagues).filter(([, l]) => l.players?.length);
  const winner = latest?.players?.find(p => p.finish === 1);
  return <>
    <View style={s.hero}>
      <Image source={require('./assets/cyp-logo.jpeg')} style={s.brandImage} resizeMode="contain" />
      <Text style={s.eyebrow}>BRIDLINGTON CYP</Text><Text style={s.heroTitle}>CYP POKER</Text>
      <Text style={s.subtitle}>Tournaments · Leagues · Player Stats</Text>
    </View>
    <Heading title="Next tournament" action="VIEW ALL" />
    <Pressable onPress={() => go('Games')}><Card gold>
      <Text style={s.pill}>UPCOMING</Text>
      <Text style={s.feature}>{cleanText(next?.details) || 'Tournament to be announced'}</Text>
      <Text style={s.gold}>{date(next?.date)}{next?.time ? `  ·  ${next.time}` : ''}</Text>
      <Text style={s.hint}>Tap to view tournament information →</Text>
    </Card></Pressable>
    {nextLeagues.length > 0 && <>
      <Heading title="Upcoming league games" action="LEAGUES" />
      <Card>{nextLeagues.map(([key, game], i) => <Pressable key={key} onPress={() => go('Leagues')} style={[s.row, s.listRow, i > 0 && s.divider]}>
        <View style={s.flex}>
          <Text style={s.rowTitleSmall}>{cleanText(game.details) || key}</Text>
          <Text style={s.faint}>{date(game.date)}{game.time ? ` · ${game.time}` : ''}</Text>
        </View><Text style={s.chevron}>›</Text>
      </Pressable>)}</Card>
    </>}
    <Heading title="Latest winner" action="RESULTS" />
    <Pressable onPress={() => go('Results')}><Card><View style={s.row}>
      <View style={s.badge}><Text style={s.badgeText}>🏆</Text></View>
      <View style={s.flex}><Text style={s.rowTitle}>{latest?.winner || 'No winner yet'}</Text>
        <Text style={s.muted}>{latest?.typeLabel || latest?.name || 'Tournament'}</Text><Text style={s.faint}>{date(latest?.date)}</Text>
      </View><Text style={s.amount}>{money(winner?.winnings)}</Text>
    </View></Card></Pressable>
    <Heading title="League leaders" action="TABLES" />
    <Card>{leagues.map(([key, league], i) => {
      const leader = [...(league.players ?? [])].sort((a, b) => Number(b.points) - Number(a.points))[0];
      return <Pressable key={key} onPress={() => go('Leagues')} style={[s.row, s.listRow, i > 0 && s.divider]}>
        <View style={s.rank}><Text style={s.rankText}>1</Text></View><View style={s.flex}>
          <Text style={s.faint}>{league.name || key}</Text><Text style={s.rowTitleSmall}>{leader?.name || 'No players'}</Text>
        </View><Text style={s.amountSmall}>{leader?.points ?? 0} pts</Text>
      </Pressable>;
    })}</Card>
  </>;
}

function Games({ data }: { data: Data }) {
  const [selected, setSelected] = useState<Tournament | null>(null);
  const next = data.homepage.nextTournament;
  const nextLeagues = Object.entries(data.homepage.nextLeagues ?? {}).filter(([, game]) => game?.status !== 'tbc' && (game?.date || game?.details));
  if (selected) {
    const finishers = [...(selected.players ?? [])].sort((a, b) => Number(a.finish ?? 999) - Number(b.finish ?? 999));
    return <><Pressable onPress={() => setSelected(null)}><Text style={s.back}>‹ Back to tournaments</Text></Pressable>
      <Title title={selected.typeLabel || selected.name || 'Tournament'} subtitle={date(selected.date)} />
      <Card gold>
        <Text style={s.rowTitle}>{selected.entries ?? 0} entries · Prize pool {money(selected.prizePool)}</Text>
        {selected.buyIn ? <Text style={s.muted}>Buy-in {money(selected.buyIn)}</Text> : null}
        {selected.startingStack ? <Text style={s.muted}>Starting stack {Number(selected.startingStack).toLocaleString('en-GB')}</Text> : null}
      </Card>
      <Heading title="Final standings" />
      {finishers.length ? <Card>{finishers.map((p, i) => <View key={`${p.name}-${i}`} style={[s.tableRow, i > 0 && s.divider]}>
        <View style={[s.rank, p.finish === 1 && s.rankGold]}><Text style={s.rankText}>{p.finish ?? i + 1}</Text></View>
        <Text numberOfLines={1} style={[s.flex, s.white]}>{p.name}</Text>
        <Text style={s.amountSmall}>{Number(p.winnings ?? 0) > 0 ? money(p.winnings) : ''}</Text>
      </View>)}</Card> : <Card><Text style={s.muted}>No player standings are available for this tournament.</Text></Card>}
    </>;
  }
  return <><Title title="Tournaments" subtitle="What’s coming up and what’s been played" />
    <Heading title="Upcoming" /><Card gold><Text style={s.feature}>{cleanText(next?.details) || 'Tournament to be announced'}</Text>
      <Text style={s.gold}>{date(next?.date)}{next?.time ? `  ·  ${next.time}` : ''}</Text></Card>
    {nextLeagues.length > 0 && <>
      <Heading title="Upcoming league games" />
      {nextLeagues.map(([key, game]) => <Card key={key}>
        <Text style={s.rowTitle}>{cleanText(game.details) || key}</Text>
        <Text style={s.gold}>{date(game.date)}{game.time ? ` · ${game.time}` : ''}</Text>
      </Card>)}
    </>}
    <Heading title="Recent tournaments" />
    {data.tournaments.slice(0, 12).map((t, i) => <Pressable key={t.code || t.id || i} onPress={() => setSelected(t)}><Card><View style={s.row}>
      <View style={s.flex}><Text style={s.rowTitle}>{t.typeLabel || t.name || 'Tournament'}</Text>
        <Text style={s.faint}>{date(t.date)} · {t.entries ?? 0} entries</Text></View><Text style={s.chevron}>›</Text>
    </View><Text style={s.muted}>Winner  <Text style={s.white}>{t.winner || '—'}</Text></Text>
      <Text style={s.muted}>Prize pool  <Text style={s.gold}>{money(t.prizePool)}</Text></Text></Card></Pressable>)}
  </>;
}

function Leagues({ data }: { data: Data }) {
  return <><Title title="Leagues" subtitle="Current CYP standings" />
    {Object.entries(data.leagues).filter(([, l]) => l.players?.length).map(([key, league]) => {
      const players = [...(league.players ?? [])].sort((a, b) => Number(b.points) - Number(a.points));
      return <View key={key}><Heading title={league.name || key} action={`${league.gamesPlayed ?? 0}/${league.totalGames ?? 0} GAMES`} />
        <Card><View style={s.tableHead}><Text style={s.pos}>POS</Text><Text style={[s.flex, s.faint]}>PLAYER</Text>
          <Text style={s.num}>P</Text><Text style={s.num}>W</Text><Text style={s.pts}>PTS</Text></View>
          {players.map((p, i) => <View key={p.name} style={[s.tableRow, i > 0 && s.divider]}>
            <View style={[s.rank, i === 0 && s.rankGold]}><Text style={s.rankText}>{i + 1}</Text></View>
            <Text numberOfLines={1} style={[s.flex, s.white]}>{p.name}</Text><Text style={s.num}>{p.played ?? 0}</Text>
            <Text style={s.num}>{p.wins ?? 0}</Text><Text style={s.pts}>{p.points ?? 0}</Text>
          </View>)}</Card>
      </View>;
    })}
    <Pressable onPress={() => Linking.openURL('https://www.cyppoker.co.uk')}><Text style={s.webLink}>View the full league tables on cyppoker.co.uk →</Text></Pressable>
  </>;
}

function Players({ data }: { data: Data }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const rows = useMemo(() => {
    const tournamentPlayers = data.tournaments.flatMap(t => t.players ?? []);
    return data.players.filter(n => n.toLowerCase().includes(query.trim().toLowerCase())).map(name => {
      const tour = tournamentPlayers.filter(p => p.name.toLowerCase() === name.toLowerCase());
      const league = Object.values(data.leagues).flatMap(l => l.players ?? []).filter(p => p.name.toLowerCase() === name.toLowerCase());
      return { name, tournamentWins: tour.filter(p => p.finish === 1).length, leagueWins: league.reduce((a, p) => a + Number(p.wins ?? 0), 0),
        winnings: tour.reduce((a, p) => a + Number(p.winnings ?? 0), 0), points: league.reduce((a, p) => a + Number(p.points ?? 0), 0),
        tournaments: tour.length, leaguePlayed: league.reduce((a, p) => a + Number(p.played ?? 0), 0) };
    });
  }, [data, query]);
  if (selected) {
    const row = rows.find(p => p.name === selected) ?? (() => {
      const tour = data.tournaments.flatMap(t => t.players ?? []).filter(p => p.name.toLowerCase() === selected.toLowerCase());
      const league = Object.values(data.leagues).flatMap(l => l.players ?? []).filter(p => p.name.toLowerCase() === selected.toLowerCase());
      return { name:selected, tournamentWins:tour.filter(p => p.finish === 1).length, leagueWins:league.reduce((a,p)=>a+Number(p.wins??0),0),
        winnings:tour.reduce((a,p)=>a+Number(p.winnings??0),0), points:league.reduce((a,p)=>a+Number(p.points??0),0), tournaments:tour.length,
        leaguePlayed:league.reduce((a,p)=>a+Number(p.played??0),0) };
    })();
    const results = data.tournaments.filter(t => t.players?.some(p => p.name.toLowerCase() === selected.toLowerCase())).slice(0, 10);
    return <><Pressable onPress={() => setSelected(null)}><Text style={s.back}>‹ Back to players</Text></Pressable>
      <Title title={row.name} subtitle="CYP player profile" />
      <View style={s.statsGrid}>
        <Card><Text style={s.statValue}>{row.tournamentWins}</Text><Text style={s.faint}>Tournament wins</Text></Card>
        <Card><Text style={s.statValue}>{row.leagueWins}</Text><Text style={s.faint}>League wins</Text></Card>
        <Card><Text style={s.statValue}>{row.points}</Text><Text style={s.faint}>League points</Text></Card>
        <Card><Text style={s.statValue}>{money(row.winnings)}</Text><Text style={s.faint}>Tournament winnings</Text></Card>
      </View>
      <Heading title="Recent tournament results" />
      {results.length ? results.map((t, i) => {
        const p = t.players?.find(x => x.name.toLowerCase() === selected.toLowerCase());
        return <Card key={t.code || t.id || i}><View style={s.row}><View style={s.flex}>
          <Text style={s.rowTitleSmall}>{t.typeLabel || t.name || 'Tournament'}</Text>
          <Text style={s.faint}>{date(t.date)} · Finish {p?.finish ?? '—'}</Text>
        </View><Text style={s.amountSmall}>{Number(p?.winnings ?? 0) > 0 ? money(p?.winnings) : ''}</Text></View></Card>;
      }) : <Card><Text style={s.muted}>No tournament history is available for this player yet.</Text></Card>}
    </>;
  }
  return <><Title title="Players" subtitle={`${data.players.length} CYP player profiles`} />
    <View style={s.search}><Text style={s.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery}
      placeholder="Search players" placeholderTextColor={C.muted} autoCorrect={false} style={s.input} /></View>
    {rows.map(p => <Pressable key={p.name} onPress={() => setSelected(p.name)}><Card><View style={s.row}><View style={s.avatar}><Text style={s.gold}>{p.name[0]}</Text></View>
      <View style={s.flex}><Text style={s.rowTitle}>{p.name}</Text><Text style={s.faint}>{p.tournamentWins + p.leagueWins} wins · {p.points} league points</Text></View>
      <Text style={s.chevron}>›</Text></View></Card></Pressable>)}
  </>;
}

function Results({ data }: { data: Data }) {
  return <><Title title="Winners & Results" subtitle="The latest from the tables" />
    {data.tournaments.map((t, i) => { const winner = t.players?.find(p => p.finish === 1); return <Card key={t.code || t.id || i}>
      <View style={s.row}><View style={s.resultIcon}><Text style={s.resultIconText}>♠</Text></View><View style={s.flex}>
        <Text style={s.rowTitle}>{t.winner || winner?.name || 'Winner'}</Text><Text style={s.muted}>{t.typeLabel || t.name}</Text>
        <Text style={s.faint}>{date(t.date)}</Text></View><Text style={s.amount}>{money(winner?.winnings)}</Text></View>
    </Card>; })}</>;
}

const tabs: { key: Tab; icon: string }[] = [
  { key: 'Home', icon: '⌂' }, { key: 'Games', icon: '♠' }, { key: 'Leagues', icon: '♛' },
  { key: 'Players', icon: '♙' }, { key: 'Results', icon: '★' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('Home');
  const [data, setData] = useState<Data>(empty);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    try { setData(await loadData()); setError(''); }
    catch { setError('Could not load the latest CYP Poker information. Pull down to try again.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const content = tab === 'Home' ? <Home data={data} go={setTab} /> : tab === 'Games' ? <Games data={data} /> :
    tab === 'Leagues' ? <Leagues data={data} /> : tab === 'Players' ? <Players data={data} /> : <Results data={data} />;
  return <SafeAreaView style={s.safe}><StatusBar style="light" />
    <View style={s.appBar}><Text style={s.appLogo}>♠</Text><Text style={s.appTitle}>{CLUB.name}</Text><View style={s.online} /></View>
    {loading ? <View style={s.loader}><ActivityIndicator color={C.gold} size="large" /><Text style={s.muted}>Loading CYP Poker…</Text></View> :
      <ScrollView key={tab} style={s.flex} contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refresh(true)} tintColor={C.gold} />}>
        {error ? <View style={s.error}><Text style={s.errorText}>{error}</Text></View> : null}{content}
      </ScrollView>}
    <View style={s.tabs}>{tabs.map(item => { const active = item.key === tab; return <Pressable key={item.key} onPress={() => setTab(item.key)} style={s.tab}>
      <Text style={[s.tabIcon, active && s.active]}>{item.icon}</Text><Text style={[s.tabLabel, active && s.active]}>{item.key}</Text>
    </Pressable>; })}</View>
  </SafeAreaView>;
}

const C = CLUB.colours;
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg }, flex: { flex: 1 },
  appBar: { height: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', backgroundColor: '#071b31', borderBottomWidth: 1, borderBottomColor: '#16324d' },
  appLogo: { color: C.gold, fontSize: 26, marginRight: 9 }, appTitle: { flex: 1, color: C.text, fontSize: 18, fontWeight: '800' },
  online: { width: 8, height: 8, borderRadius: 8, backgroundColor: '#37c979' }, scroll: { paddingHorizontal: 16, paddingBottom: 28 },
  hero: { alignItems: 'center', paddingTop: 28, paddingBottom: 22 }, brandImage: { width: 315, maxWidth: '94%', height: 82, marginBottom: 12 },
  eyebrow: { color: C.gold, fontWeight: '900', fontSize: 11, letterSpacing: 3 },
  heroTitle: { color: C.text, fontWeight: '900', fontSize: 35, letterSpacing: 1.2 }, subtitle: { color: C.muted, fontSize: 13, marginTop: 4 },
  heading: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 9 }, headingText: { flex: 1, color: C.text, fontWeight: '800', fontSize: 18 },
  action: { color: C.gold, fontWeight: '800', fontSize: 10, letterSpacing: 1 }, card: { backgroundColor: C.panel, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#193855' },
  goldCard: { backgroundColor: C.raised, borderColor: '#806c34' }, pill: { alignSelf: 'flex-start', color: C.text, backgroundColor: C.blue, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4, fontSize: 9, fontWeight: '900', marginBottom: 10 },
  feature: { color: C.text, fontSize: 23, fontWeight: '900' }, gold: { color: C.gold, fontWeight: '900', marginTop: 5 }, hint: { color: C.muted, fontSize: 12, marginTop: 14 },
  row: { flexDirection: 'row', alignItems: 'center' }, badge: { width: 50, height: 50, borderRadius: 14, backgroundColor: '#3a3b2c', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  badgeText: { fontSize: 25 }, rowTitle: { color: C.text, fontSize: 17, fontWeight: '900' }, rowTitleSmall: { color: C.text, fontSize: 15, fontWeight: '800' },
  muted: { color: C.muted, fontSize: 13, marginTop: 3 }, faint: { color: '#7893ad', fontSize: 11, marginTop: 3 }, white: { color: C.text, fontWeight: '800' },
  amount: { color: C.gold, fontWeight: '900', fontSize: 18 }, amountSmall: { color: C.gold, fontWeight: '900', fontSize: 15 }, listRow: { paddingVertical: 9 },
  divider: { borderTopWidth: 1, borderTopColor: '#193855' }, rank: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1c3a57', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rankGold: { backgroundColor: '#51482c' }, rankText: { color: C.text, fontSize: 12, fontWeight: '900' },
  titleWrap: { paddingTop: 25, paddingBottom: 7 }, title: { color: C.text, fontSize: 30, fontWeight: '900' }, chevron: { color: C.gold, fontSize: 28 },
  tableHead: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 }, tableRow: { minHeight: 47, flexDirection: 'row', alignItems: 'center' },
  pos: { width: 40, color: '#7893ad', fontSize: 9, fontWeight: '800' }, num: { width: 32, color: C.muted, textAlign: 'center', fontSize: 12 },
  pts: { width: 40, color: C.gold, textAlign: 'right', fontWeight: '900' }, search: { height: 48, flexDirection: 'row', alignItems: 'center', backgroundColor: C.panel, borderRadius: 14, paddingHorizontal: 14, marginTop: 16, marginBottom: 12 },
  searchIcon: { color: C.gold, fontSize: 24, marginRight: 9 }, input: { flex: 1, color: C.text, fontSize: 16 }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  resultIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, resultIconText: { color: C.bg, fontSize: 25 },
  back: { color: C.gold, fontWeight: '800', fontSize: 14, marginTop: 18, marginBottom: -8 }, webLink: { color: C.gold, textAlign: 'center', fontWeight: '800', paddingVertical: 18 },
  statsGrid: { gap: 0 }, statValue: { color: C.gold, fontSize: 24, fontWeight: '900' },
  error: { backgroundColor: '#4a2029', borderRadius: 12, padding: 12, marginTop: 14 }, errorText: { color: '#ffb0b8' }, loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  tabs: { minHeight: 67, paddingTop: 7, paddingBottom: 5, flexDirection: 'row', backgroundColor: '#071b31', borderTopWidth: 1, borderTopColor: '#16324d' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' }, tabIcon: { color: '#7893ad', fontSize: 20, height: 25 }, tabLabel: { color: '#7893ad', fontSize: 9, fontWeight: '700' }, active: { color: C.gold },
});
