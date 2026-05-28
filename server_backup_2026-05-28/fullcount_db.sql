--
-- PostgreSQL database dump
--

\restrict FSg54cWHsHrRTRs99QgVV5YIKxieAv2W80zezaEb4HeoqK1AsuokxF6O5gTZbqp

-- Dumped from database version 13.23
-- Dumped by pg_dump version 13.23

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cheering_songs; Type: TABLE; Schema: public; Owner: fullcount_user
--

CREATE TABLE public.cheering_songs (
    id integer NOT NULL,
    team_id character varying,
    title character varying NOT NULL,
    type character varying,
    youtube_url character varying,
    lyrics text
);


ALTER TABLE public.cheering_songs OWNER TO fullcount_user;

--
-- Name: cheering_songs_id_seq; Type: SEQUENCE; Schema: public; Owner: fullcount_user
--

CREATE SEQUENCE public.cheering_songs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.cheering_songs_id_seq OWNER TO fullcount_user;

--
-- Name: cheering_songs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: fullcount_user
--

ALTER SEQUENCE public.cheering_songs_id_seq OWNED BY public.cheering_songs.id;


--
-- Name: games; Type: TABLE; Schema: public; Owner: fullcount_user
--

CREATE TABLE public.games (
    id character varying NOT NULL,
    date date NOT NULL,
    "time" time without time zone,
    venue character varying,
    home_team_id character varying,
    away_team_id character varying,
    status character varying,
    home_score integer,
    away_score integer
);


ALTER TABLE public.games OWNER TO fullcount_user;

--
-- Name: stadiums; Type: TABLE; Schema: public; Owner: fullcount_user
--

CREATE TABLE public.stadiums (
    id character varying NOT NULL,
    name character varying NOT NULL,
    home_team_id character varying
);


ALTER TABLE public.stadiums OWNER TO fullcount_user;

--
-- Name: standings; Type: TABLE; Schema: public; Owner: fullcount_user
--

CREATE TABLE public.standings (
    id integer NOT NULL,
    date date NOT NULL,
    team_id character varying,
    rank integer,
    wins integer,
    draws integer,
    losses integer,
    win_rate numeric(5,3),
    game_behind numeric(5,1),
    streak character varying
);


ALTER TABLE public.standings OWNER TO fullcount_user;

--
-- Name: standings_id_seq; Type: SEQUENCE; Schema: public; Owner: fullcount_user
--

CREATE SEQUENCE public.standings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.standings_id_seq OWNER TO fullcount_user;

--
-- Name: standings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: fullcount_user
--

ALTER SEQUENCE public.standings_id_seq OWNED BY public.standings.id;


--
-- Name: teams; Type: TABLE; Schema: public; Owner: fullcount_user
--

CREATE TABLE public.teams (
    id character varying NOT NULL,
    name character varying NOT NULL,
    full_name character varying
);


ALTER TABLE public.teams OWNER TO fullcount_user;

--
-- Name: cheering_songs id; Type: DEFAULT; Schema: public; Owner: fullcount_user
--

ALTER TABLE ONLY public.cheering_songs ALTER COLUMN id SET DEFAULT nextval('public.cheering_songs_id_seq'::regclass);


--
-- Name: standings id; Type: DEFAULT; Schema: public; Owner: fullcount_user
--

ALTER TABLE ONLY public.standings ALTER COLUMN id SET DEFAULT nextval('public.standings_id_seq'::regclass);


--
-- Data for Name: cheering_songs; Type: TABLE DATA; Schema: public; Owner: fullcount_user
--

COPY public.cheering_songs (id, team_id, title, type, youtube_url, lyrics) FROM stdin;
\.


--
-- Data for Name: games; Type: TABLE DATA; Schema: public; Owner: fullcount_user
--

COPY public.games (id, date, "time", venue, home_team_id, away_team_id, status, home_score, away_score) FROM stdin;
20260512-HHWO-0	2026-05-12	18:30:00	고척	kiwoom	hanwha	scheduled	\N	\N
20260512-OBHT-0	2026-05-12	18:30:00	광주	kia	doosan	scheduled	\N	\N
20260512-NCLT-0	2026-05-12	18:30:00	사직	lotte	nc	scheduled	\N	\N
20260512-SKKT-0	2026-05-12	18:30:00	수원	kt	ssg	scheduled	\N	\N
20260512-SSLG-0	2026-05-12	18:30:00	잠실	lg	samsung	scheduled	\N	\N
\.


--
-- Data for Name: stadiums; Type: TABLE DATA; Schema: public; Owner: fullcount_user
--

COPY public.stadiums (id, name, home_team_id) FROM stdin;
\.


--
-- Data for Name: standings; Type: TABLE DATA; Schema: public; Owner: fullcount_user
--

COPY public.standings (id, date, team_id, rank, wins, draws, losses, win_rate, game_behind, streak) FROM stdin;
\.


--
-- Data for Name: teams; Type: TABLE DATA; Schema: public; Owner: fullcount_user
--

COPY public.teams (id, name, full_name) FROM stdin;
doosan	두산	두산 베어스
lg	LG	LG 트윈스
kiwoom	키움	키움 히어로즈
ssg	SSG	SSG 랜더스
hanwha	한화	한화 이글스
kt	KT	KT 위즈
kia	KIA	KIA 타이거즈
lotte	롯데	롯데 자이언츠
samsung	삼성	삼성 라이온즈
nc	NC	NC 다이노스
\.


--
-- Name: cheering_songs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: fullcount_user
--

SELECT pg_catalog.setval('public.cheering_songs_id_seq', 1, false);


--
-- Name: standings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: fullcount_user
--

SELECT pg_catalog.setval('public.standings_id_seq', 1, false);


--
-- Name: cheering_songs cheering_songs_pkey; Type: CONSTRAINT; Schema: public; Owner: fullcount_user
--

ALTER TABLE ONLY public.cheering_songs
    ADD CONSTRAINT cheering_songs_pkey PRIMARY KEY (id);


--
-- Name: games games_pkey; Type: CONSTRAINT; Schema: public; Owner: fullcount_user
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_pkey PRIMARY KEY (id);


--
-- Name: stadiums stadiums_pkey; Type: CONSTRAINT; Schema: public; Owner: fullcount_user
--

ALTER TABLE ONLY public.stadiums
    ADD CONSTRAINT stadiums_pkey PRIMARY KEY (id);


--
-- Name: standings standings_pkey; Type: CONSTRAINT; Schema: public; Owner: fullcount_user
--

ALTER TABLE ONLY public.standings
    ADD CONSTRAINT standings_pkey PRIMARY KEY (id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: fullcount_user
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: cheering_songs cheering_songs_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fullcount_user
--

ALTER TABLE ONLY public.cheering_songs
    ADD CONSTRAINT cheering_songs_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: games games_away_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fullcount_user
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_away_team_id_fkey FOREIGN KEY (away_team_id) REFERENCES public.teams(id);


--
-- Name: games games_home_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fullcount_user
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_home_team_id_fkey FOREIGN KEY (home_team_id) REFERENCES public.teams(id);


--
-- Name: stadiums stadiums_home_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fullcount_user
--

ALTER TABLE ONLY public.stadiums
    ADD CONSTRAINT stadiums_home_team_id_fkey FOREIGN KEY (home_team_id) REFERENCES public.teams(id);


--
-- Name: standings standings_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: fullcount_user
--

ALTER TABLE ONLY public.standings
    ADD CONSTRAINT standings_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- PostgreSQL database dump complete
--

\unrestrict FSg54cWHsHrRTRs99QgVV5YIKxieAv2W80zezaEb4HeoqK1AsuokxF6O5gTZbqp

