import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchCookies,
  fetchHumanCookies,
  fetchLastGrab,
  fetchJarName,
  grantCookie,
  type Cookie,
  type HumanCookie,
  type LastGrab,
  type Category,
} from "@/api/client.js";

const POLL_INTERVAL = 3000;

export function useJar() {
  const [cookies, setCookies] = useState<Cookie[]>([]);
  const [humanCookies, setHumanCookies] = useState<HumanCookie[]>([]);
  const [lastGrab, setLastGrab] = useState<LastGrab | null>(null);
  const [jarName, setJarName] = useState("Cookie Jar");
  const [loading, setLoading] = useState(true);
  const prevCount = useRef(0);
  const [shaking, setShaking] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [c, h, g] = await Promise.all([
        fetchCookies(),
        fetchHumanCookies(),
        fetchLastGrab(),
      ]);
      setCookies(c);
      setHumanCookies(h);
      setLastGrab(g);
    } catch {}
  }, []);

  // Initial load
  useEffect(() => {
    async function init() {
      try {
        const [c, h, g, name] = await Promise.all([
          fetchCookies(),
          fetchHumanCookies(),
          fetchLastGrab(),
          fetchJarName(),
        ]);
        setCookies(c);
        setHumanCookies(h);
        setLastGrab(g);
        setJarName(name);
        prevCount.current = c.length;
      } catch {}
      setLoading(false);
    }
    init();
  }, []);

  // Polling
  useEffect(() => {
    const id = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [refresh]);

  // Shake detection — when count increases
  useEffect(() => {
    if (cookies.length > prevCount.current && prevCount.current > 0) {
      setShaking(true);
      const t = setTimeout(() => setShaking(false), 500);
      return () => clearTimeout(t);
    }
    prevCount.current = cookies.length;
  }, [cookies.length]);

  const grant = useCallback(
    async (message: string, category: Category, scope: string | null) => {
      const cookie = await grantCookie(message, category, scope);
      setCookies((prev) => [...prev, cookie]);
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    },
    [],
  );

  return {
    cookies,
    humanCookies,
    lastGrab,
    jarName,
    loading,
    shaking,
    grant,
    refresh,
  };
}
