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
type TournamentPlayer = { name: string; finish?: number; winnings?: number; spent?: number; buyIn?: number; rebuys?: number; bountyWon?: number; finalBounty?: number };
type Tournament = { id?: number; code?: string; name?: string; typeLabel?: string; tournamentType?: string; date?: string; winner?: string; entries?: number; prizePool?: number; buyIn?: number; startingStack?: number; paidPlaces?: number; format?: string; theme?: string; charityRaised?: number; players?: TournamentPlayer[]; finishingOrder?: TournamentPlayer[] };
type LeaguePlayer = { name: string; played?: number; gamesPlayed?: number; wins?: number; bounties?: number; points?: number; averagePoints?: number; averagePosition?: number; position?: number };
type League = { name?: string; seasonName?: string; gamesPlayed?: number; totalGames?: number; gamesRemaining?: number; gamesPerPlayer?: number; playersPerGame?: number; players?: LeaguePlayer[]; table?: LeaguePlayer[] };
type UpcomingGame = { date?: string; time?: string; details?: string; status?: string };
type LeagueGameResult = { player?: string; name?: string; finish?: number; points?: number; bounties?: number; eliminatedBy?: string };
type LeagueGame = { id?: string|number; season?: string; division?: string; divisionName?: string; gameNumber?: number; date?: string; entrants?: number; winner?: string; results?: LeagueGameResult[] };
type TournamentHistoryRow = { id?: number|string; code?: string; date?: string; tournament?: string; tournamentName?: string; name?: string; type?: string; format?: string; finish?: number; spent?: number; winnings?: number; bountyWinnings?: number; bountyWon?: number };
type LeagueSeason = { division?: string; divisionName?: string; season?: string; seasonName?: string; status?: string; games?: number; wins?: number; bounties?: number; points?: number; averagePoints?: number; averagePosition?: number; finalPosition?: number };
type PlayerLeagueHistoryRow = { id?: number|string; date?: string; gameNumber?: number; divisionKey?: string; divisionName?: string; seasonName?: string; tournamentCode?: string; finish?: number; points?: number; bounties?: number; eliminatedBy?: string };
type PlayerProfile = { name: string; tournament?: { games?: number; wins?: number; cashes?: number; eliminations?: number; winnings?: number; totalSpent?: number; averageFinish?: number; history?: TournamentHistoryRow[] }; league?: { totals?: { games?: number; wins?: number; bounties?: number; points?: number; averagePoints?: number; averagePosition?: number }; current?: any; seasons?: LeagueSeason[]; gameHistory?: PlayerLeagueHistoryRow[] } };
type LiveSeat = { seat?: number|string; player?: string; locked?: boolean };
type LiveTable = { table?: number|string; seats?: LiveSeat[] };
type LiveGame = { code?: string; name?: string; typeLabel?: string; format?: string; theme?: string; date?: string; levelIndex?: number; currentLevel?: any; nextLevel?: any; clock?: { secondsRemaining?: number; running?: boolean; paused?: boolean; isBreak?: boolean }; entries?: number; playersRemaining?: number; players?: any[]; startingStack?: number; chipsInPlay?: number; averageStack?: number; prizePool?: number; charityRaised?: number; paidPlaces?: number; payoutType?: string; payoutAmounts?: number[]; seating?: { finalTable?: boolean; tables?: LiveTable[] }; tableBalanceAlert?: any; mysteryBounty?: any } ;
type Data = {
  homepage: { nextTournament?: UpcomingGame; nextLeagues?: Record<string, UpcomingGame>; latestWinners?: any[]; latestLeagueWinners?: any[]; leagueLeaders?: any[]; liveGames?: LiveGame[] };
  tournaments: Tournament[];
  leagues: Record<string, League>;
  players: string[];
  profiles: PlayerProfile[];
  leagueGames: LeagueGame[];
  liveGames: LiveGame[];
};
const empty: Data = { homepage: {}, tournaments: [], leagues: {}, players: [], profiles: [], leagueGames: [], liveGames: [] };

async function get<T>(path: string): Promise<T> {
  const response = await fetch(CLUB.api + path);
  if (!response.ok) throw new Error(String(response.status));
  return response.json() as Promise<T>;
}

async function loadData(): Promise<Data> {
  const [homepage, history, leagueData, playerData, profileData, gameData, liveData] = await Promise.all([
    get<Data['homepage']>('/api/public/homepage'),
    get<{ tournaments?: Tournament[] }>('/api/public/tournaments'),
    get<{ leagues?: Record<string, League> }>('/api/public/leagues'),
    get<{ players?: string[] }>('/api/public/players'),
    get<{ players?: PlayerProfile[]; profiles?: PlayerProfile[] }>('/api/public/player-profiles').catch(() => ({ players: [], profiles: [] })),
    get<{ games?: LeagueGame[] }>('/api/public/league-games').catch(() => ({ games: [] })),
    get<{ games?: LiveGame[] }>('/api/public/live').catch(() => ({ games: [] })),
  ]);
  return {
    homepage, tournaments: history.tournaments ?? [], leagues: leagueData.leagues ?? {}, players: playerData.players ?? [],
    profiles: profileData.players ?? profileData.profiles ?? [], leagueGames: gameData.games ?? [], liveGames: liveData.games ?? []
  };
}

const money = (value?: number) => `£${Number(value ?? 0).toLocaleString('en-GB')}`;
const cleanText = (value?: string) => String(value ?? '').replace(/Â£/g, '£');
const number = (value?: number) => Number(value ?? 0).toLocaleString('en-GB');
const average = (value?: number) => value == null || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('en-GB', { maximumFractionDigits: 2 });
function clock(value?: number) {
  const total = Math.max(0, Number(value ?? 0));
  const minutes = Math.floor(total / 60), seconds = Math.floor(total % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
function blindLine(level: any) {
  if (!level) return '';
  if (level.type === 'break') return 'Break';
  const small = level.small ?? level.smallBlind, big = level.big ?? level.bigBlind, ante = level.ante;
  if (small != null && big != null) return `${number(small)} / ${number(big)}${Number(ante ?? 0) > 0 ? ` · Ante ${number(ante)}` : ''}`;
  return String(level.label ?? level.name ?? '');
}
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
    {data.liveGames.length > 0 && <><Heading title="Live now" /><Card gold>{data.liveGames.map((g,i)=><View key={g.code||String(i)} style={i>0?s.divider:undefined}><Text style={s.pill}>LIVE</Text><Text style={s.rowTitle}>{g.typeLabel||g.name||'Tournament'}</Text><Text style={s.muted}>{g.playersRemaining ?? 0} remaining · Avg stack {Number(g.averageStack??0).toLocaleString('en-GB')}</Text><Text style={s.gold}>{g.clock?.isBreak?'Break':`Level ${Number(g.levelIndex??0)+1}`}</Text></View>)}</Card></>}
    <Heading title="Next tournament" action="VIEW ALL" />
    {next?.status !== 'tbc' && (next?.date || next?.details) ? <Pressable onPress={() => go('Games')}><Card gold>
      <Text style={s.pill}>UPCOMING</Text>
      <Text style={s.feature}>{cleanText(next?.details) || 'Tournament'}</Text>
      <Text style={s.gold}>{date(next?.date)}{next?.time ? `  ·  ${next.time}` : ''}</Text>
      <Text style={s.hint}>Tap to view tournament information →</Text>
    </Card></Pressable> : <Card><Text style={s.muted}>No tournament is currently scheduled.</Text></Card>}
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
  const [selectedLive, setSelectedLive] = useState<LiveGame | null>(null);
  const next = data.homepage.nextTournament;
  const nextLeagues = Object.entries(data.homepage.nextLeagues ?? {}).filter(([, game]) => game?.status !== 'tbc' && (game?.date || game?.details));

  if (selectedLive) {
    const g = selectedLive;
    return <><Pressable onPress={() => setSelectedLive(null)}><Text style={s.back}>‹ Back to tournaments</Text></Pressable>
      <Title title={g.typeLabel || g.name || 'Live Tournament'} subtitle={g.code ? `Live · ${g.code}` : 'Live tournament'} />
      <Card gold>
        <Text style={s.pill}>LIVE</Text>
        <Text style={s.feature}>{g.clock?.isBreak ? 'Break' : blindLine(g.currentLevel) || `Level ${Number(g.levelIndex ?? 0) + 1}`}</Text>
        <Text style={s.gold}>{clock(g.clock?.secondsRemaining)} remaining</Text>
        <Text style={s.muted}>{g.clock?.running ? 'Clock running' : g.clock?.paused ? 'Clock paused' : ''}</Text>
      </Card>
      <Heading title="Tournament status" />
      <View style={s.statRow}>
        <View style={s.miniStat}><Text style={s.statValue}>{g.entries ?? 0}</Text><Text style={s.faint}>Entries</Text></View>
        <View style={s.miniStat}><Text style={s.statValue}>{g.playersRemaining ?? 0}</Text><Text style={s.faint}>Remaining</Text></View>
        <View style={s.miniStat}><Text style={s.statValue}>{number(g.averageStack)}</Text><Text style={s.faint}>Average stack</Text></View>
      </View>
      <View style={s.statRow}>
        <View style={s.miniStat}><Text style={s.statValue}>{number(g.chipsInPlay)}</Text><Text style={s.faint}>Chips in play</Text></View>
        <View style={s.miniStat}><Text style={s.statValue}>{money(g.prizePool)}</Text><Text style={s.faint}>Prize pool</Text></View>
        <View style={s.miniStat}><Text style={s.statValue}>{g.paidPlaces ?? 0}</Text><Text style={s.faint}>Paid places</Text></View>
      </View>
      {g.nextLevel && <Card><Text style={s.rowTitleSmall}>Next level</Text><Text style={s.gold}>{blindLine(g.nextLevel)}</Text></Card>}
      {(g.seating?.tables ?? []).length > 0 && <><Heading title={g.seating?.finalTable ? "Final table" : "Seat draw"} />{(g.seating?.tables ?? []).map((table, ti) => <Card key={String(table.table ?? ti)}>
        <Text style={s.rowTitleSmall}>Table {table.table ?? ti + 1}</Text>
        {(table.seats ?? []).map((seat, i) => <View key={i} style={[s.tableRow, i > 0 && s.divider]}>
          <Text style={s.num}>S{seat.seat ?? '—'}</Text><Text style={[s.flex, s.white]}>{seat.player || 'Player'}</Text>{seat.locked ? <Text style={s.faint}>Locked</Text> : null}
        </View>)}
      </Card>)}</>}
      {g.tableBalanceAlert ? <Card><Text style={s.gold}>Tables unbalanced</Text><Text style={s.muted}>See the Tournament Manager/View Only screen for the current move information.</Text></Card> : null}
    </>;
  }

  if (selected) {
    const finishers = [...(selected.finishingOrder ?? selected.players ?? [])].sort((a, b) => Number(a.finish ?? 999) - Number(b.finish ?? 999));
    return <><Pressable onPress={() => setSelected(null)}><Text style={s.back}>‹ Back to tournaments</Text></Pressable>
      <Title title={selected.typeLabel || selected.name || 'Tournament'} subtitle={date(selected.date)} />
      <Card gold>
        <Text style={s.rowTitle}>{selected.entries ?? 0} entries · Prize pool {money(selected.prizePool)}</Text>
        {selected.format ? <Text style={s.muted}>Format {selected.format}</Text> : null}
        {selected.buyIn ? <Text style={s.muted}>Buy-in {money(selected.buyIn)}</Text> : null}
        {selected.startingStack ? <Text style={s.muted}>Starting stack {number(selected.startingStack)}</Text> : null}
        {selected.paidPlaces ? <Text style={s.muted}>{selected.paidPlaces} paid places</Text> : null}
        {selected.charityRaised ? <Text style={s.muted}>Charity raised {money(selected.charityRaised)}</Text> : null}
      </Card>
      <Heading title="Final standings" />
      {finishers.length ? <Card>{finishers.map((p, i) => <View key={`${p.name}-${i}`} style={[s.resultRow, i > 0 && s.divider]}>
        <View style={[s.rank, p.finish === 1 && s.rankGold]}><Text style={s.rankText}>{p.finish ?? i + 1}</Text></View>
        <View style={s.flex}><Text numberOfLines={1} style={s.white}>{p.name}</Text>
          <Text style={s.faint}>{p.spent != null ? `Spent ${money(p.spent)}` : ''}{p.rebuys != null ? ` · ${p.rebuys} rebuy${p.rebuys === 1 ? '' : 's'}` : ''}{p.bountyWon ? ` · Bounties ${money(p.bountyWon)}` : ''}</Text>
        </View>
        <Text style={s.amountSmall}>{Number(p.winnings ?? 0) > 0 ? money(p.winnings) : ''}</Text>
      </View>)}</Card> : <Card><Text style={s.muted}>No player standings are available for this tournament.</Text></Card>}
    </>;
  }

  return <><Title title="Tournaments" subtitle="Upcoming, live and completed games" />
    {data.liveGames.length > 0 && <><Heading title="Live now" />
      {data.liveGames.map((g, i) => <Pressable key={g.code || String(i)} onPress={() => setSelectedLive(g)}><Card gold>
        <View style={s.row}><View style={s.flex}><Text style={s.pill}>LIVE</Text><Text style={s.rowTitle}>{g.typeLabel || g.name || 'Tournament'}</Text>
          <Text style={s.muted}>{g.clock?.isBreak ? 'Break' : blindLine(g.currentLevel)} · {clock(g.clock?.secondsRemaining)} remaining</Text>
        </View><Text style={s.chevron}>›</Text></View>
      </Card></Pressable>)}
    </>}
    <Heading title="Upcoming" />{next?.status !== 'tbc' && (next?.date || next?.details) ? <Card gold><Text style={s.feature}>{cleanText(next?.details) || 'Tournament'}</Text>
      <Text style={s.gold}>{date(next?.date)}{next?.time ? `  ·  ${next.time}` : ''}</Text></Card> : <Card><Text style={s.muted}>No tournament is currently scheduled.</Text></Card>}
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
  const [showHistory, setShowHistory] = useState(false);
  if (showHistory) return <><Pressable onPress={() => setShowHistory(false)}><Text style={s.back}>‹ Back to league tables</Text></Pressable>
    <Title title="Completed League Games" subtitle="League game history" />
    {data.leagueGames.length ? data.leagueGames.map((g, i) => <Card key={String(g.id ?? i)}>
      <Text style={s.rowTitle}>{g.divisionName || g.division || 'League'}{g.gameNumber ? ` · Game ${g.gameNumber}` : ''}</Text>
      <Text style={s.faint}>{date(g.date)} · {g.entrants ?? g.results?.length ?? 0} players</Text>
      {(g.results ?? []).sort((a,b)=>Number(a.finish??999)-Number(b.finish??999)).map((r,j)=><View key={`${r.player||r.name}-${j}`} style={[s.tableRow,j>0&&s.divider]}>
        <View style={[s.rank,r.finish===1&&s.rankGold]}><Text style={s.rankText}>{r.finish ?? j+1}</Text></View>
        <Text style={[s.flex,s.white]} numberOfLines={1}>{r.player || r.name}</Text>
        <Text style={s.num}>{r.bounties ?? 0} B</Text><Text style={s.pts}>{r.points ?? 0}</Text>
      </View>)}
    </Card>) : <Card><Text style={s.muted}>No completed league games are available yet.</Text></Card>}
  </>;
  return <><Title title="Leagues" subtitle="Current CYP standings" />
    {Object.entries(data.leagues).filter(([, l]) => (l.table?.length || l.players?.length)).map(([key, league]) => {
      const players = [...(league.table ?? league.players ?? [])].sort((a,b)=>Number(a.position??999)-Number(b.position??999) || Number(b.points)-Number(a.points));
      return <View key={key}><Heading title={league.name || key} action={`${league.gamesPlayed ?? 0}/${league.totalGames ?? 0} GAMES`} />
        <Card><Text style={s.muted}>{league.seasonName || ''}{league.gamesRemaining != null ? ` · ${league.gamesRemaining} games remaining` : ''}{league.gamesPerPlayer != null ? ` · ${league.gamesPerPlayer} each` : ''}</Text>
          <View style={s.tableHead}><Text style={s.pos}>POS</Text><Text style={[s.flex,s.faint]}>PLAYER</Text><Text style={s.num}>P</Text><Text style={s.num}>W</Text><Text style={s.num}>B</Text><Text style={s.pts}>PTS</Text></View>
          {players.map((p,i)=><View key={p.name} style={[s.tableRow,i>0&&s.divider]}>
            <View style={[s.rank,i===0&&s.rankGold]}><Text style={s.rankText}>{p.position ?? i+1}</Text></View>
            <Text numberOfLines={1} style={[s.flex,s.white]}>{p.name}</Text><Text style={s.num}>{p.gamesPlayed ?? p.played ?? 0}</Text><Text style={s.num}>{p.wins ?? 0}</Text><Text style={s.num}>{p.bounties ?? 0}</Text><Text style={s.pts}>{p.points ?? 0}</Text>
          </View>)}
        </Card>
      </View>;
    })}
    <Pressable onPress={() => setShowHistory(true)}><Text style={s.webLink}>View completed league games →</Text></Pressable>
  </>;
}

function Players({ data }: { data: Data }) {
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState<PlayerProfile|null>(null);
  const profiles=data.profiles.length ? data.profiles : data.players.map(name=>({name}));
  const rows=profiles.filter(p=>p.name.toLowerCase().includes(query.trim().toLowerCase()));
  if(selected){
    const t=selected.tournament ?? {}, l=selected.league ?? {}, totals=l.totals ?? {};
    return <><Pressable onPress={()=>setSelected(null)}><Text style={s.back}>‹ Back to players</Text></Pressable>
      <Title title={selected.name} subtitle="Full player profile" />
      <Heading title="Tournament Record" />
      <View style={s.statRow}>{[['Games',t.games],['Wins',t.wins],['Cashes',t.cashes],['Eliminations',t.eliminations]].map(([label,v])=><View key={String(label)} style={s.miniStat}><Text style={s.statValue}>{v ?? 0}</Text><Text style={s.faint}>{label}</Text></View>)}</View>
      <View style={s.statRow}><View style={s.miniStat}><Text style={s.statValue}>{money(t.winnings)}</Text><Text style={s.faint}>Winnings</Text></View><View style={s.miniStat}><Text style={s.statValue}>{money(t.totalSpent)}</Text><Text style={s.faint}>Total spent</Text></View><View style={s.miniStat}><Text style={s.statValue}>{t.averageFinish ?? '—'}</Text><Text style={s.faint}>Average finish</Text></View></View>
      <Heading title="Tournament History" />
      {(t.history??[]).length ? (t.history??[]).map((h,i)=><Card key={String(h.id??h.code??i)}><View style={s.row}><View style={s.flex}><Text style={s.rowTitleSmall}>{h.tournament||h.tournamentName||h.name||h.type||'Tournament'}</Text><Text style={s.faint}>{date(h.date)} · Finish {h.finish ?? '—'} · Spent {money(h.spent)}</Text></View><Text style={s.amountSmall}>{Number(h.winnings??0)>0?money(h.winnings):''}</Text></View></Card>) : <Card><Text style={s.muted}>No tournament history available.</Text></Card>}
      <Heading title="League Record" />
      <View style={s.statRow}>{[['Games',totals.games],['Wins',totals.wins],['Bounties',totals.bounties],['Points',totals.points]].map(([label,v])=><View key={String(label)} style={s.miniStat}><Text style={s.statValue}>{v ?? 0}</Text><Text style={s.faint}>{label}</Text></View>)}</View>
      <View style={s.statRow}><View style={s.miniStat}><Text style={s.statValue}>{average(totals.averagePoints)}</Text><Text style={s.faint}>Average points</Text></View><View style={s.miniStat}><Text style={s.statValue}>{average(totals.averagePosition)}</Text><Text style={s.faint}>Average position</Text></View></View>
      {(Array.isArray(l.current) ? l.current : l.current ? [l.current] : []).map((cur:any, i:number) => <Card gold key={i}><Text style={s.rowTitle}>{cur.divisionName || cur.division || 'Current league'}</Text><Text style={s.muted}>{cur.seasonName || cur.season || ''}</Text></Card>)}
      <Heading title="Division History" />
      {(l.seasons??[]).length ? (l.seasons??[]).map((x,i)=><Card key={i}><Text style={s.rowTitleSmall}>{x.divisionName||x.division||'League'} · {x.seasonName||x.season||''}</Text><Text style={s.muted}>{x.games??0} games · {x.wins??0} wins · {x.bounties??0} bounties · {x.points??0} pts</Text><Text style={s.faint}>Avg points {average(x.averagePoints)} · Avg position {average(x.averagePosition)}{x.finalPosition? ` · Final ${x.finalPosition}`:''}</Text></Card>) : <Card><Text style={s.muted}>No division history available.</Text></Card>}
      <Heading title="League Game History" />
      {(l.gameHistory??[]).length ? (l.gameHistory??[]).map((g,i)=>
        <Card key={String(g.id??i)}><View style={s.row}><View style={s.flex}><Text style={s.rowTitleSmall}>{g.divisionName||g.divisionKey||'League'}{g.gameNumber?` · Game ${g.gameNumber}`:''}</Text><Text style={s.faint}>{date(g.date)} · Finish {g.finish ?? '—'}</Text></View><Text style={s.amountSmall}>{g.points ?? 0} pts</Text></View><Text style={s.muted}>{g.bounties ?? 0} bounties{g.eliminatedBy ? ` · Eliminated by ${g.eliminatedBy}` : ''}</Text></Card>
      ) : <Card><Text style={s.muted}>No league game history available.</Text></Card>}
    </>;
  }
  return <><Title title="Players" subtitle={`${profiles.length} CYP player profiles`} />
    <View style={s.search}><Text style={s.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="Search players" placeholderTextColor={C.muted} autoCorrect={false} style={s.input}/></View>
    {rows.map(p=><Pressable key={p.name} onPress={()=>setSelected(p)}><Card><View style={s.row}><View style={s.avatar}><Text style={s.gold}>{p.name[0]}</Text></View><View style={s.flex}><Text style={s.rowTitle}>{p.name}</Text><Text style={s.faint}>{p.tournament?.wins ?? 0} tournament wins · {p.league?.totals?.points ?? 0} league points</Text></View><Text style={s.chevron}>›</Text></View></Card></Pressable>)}
  </>;
}

function Results({ data }: { data: Data }) {
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 2);
  const recent = data.tournaments.filter(t => {
    if (!t.date) return true;
    const parsed = new Date(t.date + 'T12:00:00');
    return Number.isNaN(parsed.getTime()) || parsed >= cutoff;
  });
  const leagueRecent = data.leagueGames.filter(g => {
    if (!g.date) return true;
    const parsed = new Date(g.date + 'T12:00:00');
    return Number.isNaN(parsed.getTime()) || parsed >= cutoff;
  });
  return <><Title title="Winners & Results" subtitle="Results from the last two months" />
    <Heading title="Tournament results" />
    {recent.length ? recent.map((t, i) => { const winner = (t.finishingOrder ?? t.players)?.find(p => p.finish === 1); return <Card key={t.code || t.id || i}>
      <View style={s.row}><View style={s.resultIcon}><Text style={s.resultIconText}>♠</Text></View><View style={s.flex}>
        <Text style={s.rowTitle}>{t.winner || winner?.name || 'Winner'}</Text><Text style={s.muted}>{t.typeLabel || t.name}</Text>
        <Text style={s.faint}>{date(t.date)} · {t.entries ?? 0} entries</Text></View><Text style={s.amount}>{Number(winner?.winnings ?? 0) > 0 ? money(winner?.winnings) : ''}</Text></View>
    </Card>; }) : <Card><Text style={s.muted}>No tournament results are available from the last two months.</Text></Card>}
    <Heading title="League game results" />
    {leagueRecent.length ? leagueRecent.map((g, i) => <Card key={String(g.id ?? i)}><View style={s.row}>
      <View style={s.resultIcon}><Text style={s.resultIconText}>♛</Text></View><View style={s.flex}>
        <Text style={s.rowTitle}>{g.winner || (g.results ?? []).find(r => r.finish === 1)?.player || 'League game'}</Text>
        <Text style={s.muted}>{g.divisionName || g.division || 'League'}{g.gameNumber ? ` · Game ${g.gameNumber}` : ''}</Text>
        <Text style={s.faint}>{date(g.date)} · {g.entrants ?? g.results?.length ?? 0} players</Text>
      </View></View></Card>) : <Card><Text style={s.muted}>No league-game results are available from the last two months.</Text></Card>}
  </>;
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
    <View style={s.appBar}><Text style={s.appLogo}>♠</Text><Text style={s.appTitle}>{CLUB.name}</Text><View style={[s.online, error && s.offline]} /></View>
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
  online: { width: 8, height: 8, borderRadius: 8, backgroundColor: '#37c979' }, offline: { backgroundColor: '#d85b67' }, scroll: { paddingHorizontal: 16, paddingBottom: 28 },
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
  tableHead: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 }, tableRow: { minHeight: 47, flexDirection: 'row', alignItems: 'center' }, resultRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  pos: { width: 40, color: '#7893ad', fontSize: 9, fontWeight: '800' }, num: { width: 32, color: C.muted, textAlign: 'center', fontSize: 12 },
  pts: { width: 40, color: C.gold, textAlign: 'right', fontWeight: '900' }, search: { height: 48, flexDirection: 'row', alignItems: 'center', backgroundColor: C.panel, borderRadius: 14, paddingHorizontal: 14, marginTop: 16, marginBottom: 12 },
  searchIcon: { color: C.gold, fontSize: 24, marginRight: 9 }, input: { flex: 1, color: C.text, fontSize: 16 }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  resultIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', marginRight: 12 }, resultIconText: { color: C.bg, fontSize: 25 },
  back: { color: C.gold, fontWeight: '800', fontSize: 14, marginTop: 18, marginBottom: -8 }, webLink: { color: C.gold, textAlign: 'center', fontWeight: '800', paddingVertical: 18 },
  statsGrid: { gap: 0 }, statValue: { color: C.gold, fontSize: 21, fontWeight: '900' }, statRow: { flexDirection: 'row', gap: 8, marginBottom: 8 }, miniStat: { flex: 1, backgroundColor: C.panel, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#193855' },
  error: { backgroundColor: '#4a2029', borderRadius: 12, padding: 12, marginTop: 14 }, errorText: { color: '#ffb0b8' }, loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  tabs: { minHeight: 67, paddingTop: 7, paddingBottom: 5, flexDirection: 'row', backgroundColor: '#071b31', borderTopWidth: 1, borderTopColor: '#16324d' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' }, tabIcon: { color: '#7893ad', fontSize: 20, height: 25 }, tabLabel: { color: '#7893ad', fontSize: 9, fontWeight: '700' }, active: { color: C.gold },
});
