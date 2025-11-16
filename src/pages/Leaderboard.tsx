import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

type Row = { id: string; username: string; avatar_url: string | null; points: number | null };

const LeaderboardPage = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
    });
  }, [navigate]);

  const load = async () => {
    const res = await supabase
      .from("profiles")
      .select("id, username, avatar_url, points")
      .order("points", { ascending: false, nullsFirst: false });
    if (!res.error && res.data) setRows(res.data as any);
  };

  useEffect(() => {
    load();
    const chan = supabase
      .channel("leaderboard")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(chan);
    };
  }, []);

  const ranked = useMemo(() => {
    let rank = 0;
    let prev: number | null = null;
    return rows.map((r, i) => {
      const pts = r.points || 0;
      if (prev === null || pts !== prev) {
        rank = rank + 1;
        prev = pts;
      }
      return { ...r, rank } as Row & { rank: number };
    });
  }, [rows]);

  const top = ranked.slice(0, 3);
  const topPoints = ranked.length ? (ranked[0].points || 0) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Leaderboard</h1>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Top Players</CardTitle>
          </CardHeader>
          <CardContent>
            {top.length ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                {top.map((r, i) => (
                  <div key={r.id} className={`rounded p-3 border ${i===0? 'bg-yellow-50' : i===1? 'bg-gray-50' : 'bg-orange-50'}`}>
                    <div className="flex items-center gap-2">
                      <Crown className={`h-4 w-4 ${i===0? 'text-yellow-500' : i===1? 'text-gray-400' : 'text-orange-500'}`} />
                      <div className="font-medium">{r.username}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">Rank {r.rank}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="font-mono">{r.points || 0}</div>
                      <Badge variant="outline">Top {i+1}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="space-y-2">
              {ranked.map(r => (
                <div key={r.id} className="flex items-center justify-between border rounded px-3 py-2">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={r.avatar_url || undefined} />
                      <AvatarFallback>{r.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {r.username}
                        <Badge variant={r.rank===1? 'secondary':'outline'}>#{r.rank}</Badge>
                      </div>
                      <div className="h-2 w-40 bg-muted rounded mt-2">
                        <div className="h-2 bg-primary rounded" style={{ width: `${topPoints? Math.min(100, Math.round(((r.points||0)/topPoints)*100)) : 0}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="font-mono">{r.points || 0}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default LeaderboardPage;

export const LeaderboardEmbedded = () => {
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    const res = await supabase
      .from("profiles")
      .select("id, username, avatar_url, points")
      .order("points", { ascending: false, nullsFirst: false });
    if (!res.error && res.data) setRows(res.data as any);
  };

  useEffect(() => {
    load();
    const chan = supabase
      .channel("leaderboard-embedded")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(chan);
    };
  }, []);

  const ranked = useMemo(() => {
    let rank = 0;
    let prev: number | null = null;
    return rows.map((r) => {
      const pts = r.points || 0;
      if (prev === null || pts !== prev) {
        rank = rank + 1;
        prev = pts;
      }
      return { ...r, rank } as Row & { rank: number };
    });
  }, [rows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leaderboard</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {ranked.map(r => (
            <div key={r.id} className="flex items-center justify-between border rounded px-3 py-2">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={r.avatar_url || undefined} />
                  <AvatarFallback>{r.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {r.username}
                    <Badge variant={r.rank===1? 'secondary':'outline'}>#{r.rank}</Badge>
                  </div>
                  <div className="h-2 w-40 bg-muted rounded mt-2">
                    <div className="h-2 bg-primary rounded" style={{ width: `${ranked.length ? Math.min(100, Math.round(((r.points||0)/((ranked[0].points||0)||1))*100)) : 0}%` }} />
                  </div>
                </div>
              </div>
              <div className="font-mono">{r.points || 0}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
