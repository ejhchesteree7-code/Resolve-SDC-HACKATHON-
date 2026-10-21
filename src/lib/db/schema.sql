-- Development schema export. Run this file first, then seed.sql on an empty database.
-- The activity_log audit trail is physically stored as public.resolve_activity.
-- Its trigger rejects UPDATE/DELETE only; seed INSERT statements remain compatible.
BEGIN;
--
-- PostgreSQL database dump
--



-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

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

--
-- Name: reject_activity_log_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_activity_log_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'activity_log is append-only: UPDATE and DELETE are forbidden';
END;
$$;


--
-- Name: resolve_activity_sequence_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.resolve_activity_sequence_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: resolve_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resolve_activity (
    id text NOT NULL,
    review_id text NOT NULL,
    actor text NOT NULL,
    role text NOT NULL,
    action text NOT NULL,
    details text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    sequence bigint DEFAULT nextval('public.resolve_activity_sequence_seq'::regclass) NOT NULL
);


--
-- Name: resolve_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resolve_reviews (
    id text NOT NULL,
    reviewer text NOT NULL,
    outlet text NOT NULL,
    rating integer NOT NULL,
    language text NOT NULL,
    text text NOT NULL,
    sentiment text NOT NULL,
    category text NOT NULL,
    severity text NOT NULL,
    reason text NOT NULL,
    confidence real NOT NULL,
    draft_reply text NOT NULL,
    status text NOT NULL,
    assigned_role text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    missing_info boolean DEFAULT false NOT NULL,
    voucher_amount real,
    rejection_reason text,
    rule_fired text,
    used_fallback boolean DEFAULT false NOT NULL,
    tenant_id text DEFAULT 'resolve-demo'::text NOT NULL,
    outlet_id text DEFAULT 'Brew & Kin — Bangsar'::text NOT NULL,
    source text DEFAULT 'simulated'::text NOT NULL,
    final_reply text
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id text NOT NULL,
    manager_voucher_limit_rm real DEFAULT 20 NOT NULL,
    CONSTRAINT tenants_manager_voucher_limit_rm_check CHECK ((manager_voucher_limit_rm >= (0)::double precision))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id text NOT NULL,
    role text NOT NULL,
    tenant_id text NOT NULL,
    outlet_id text NOT NULL,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['Staff'::text, 'Manager'::text, 'Owner'::text])))
);


--
-- Name: resolve_activity resolve_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resolve_activity
    ADD CONSTRAINT resolve_activity_pkey PRIMARY KEY (id);


--
-- Name: resolve_reviews resolve_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resolve_reviews
    ADD CONSTRAINT resolve_reviews_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: resolve_activity activity_log_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER activity_log_immutable BEFORE DELETE OR UPDATE ON public.resolve_activity FOR EACH ROW EXECUTE FUNCTION public.reject_activity_log_mutation();


--
-- Name: users users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- PostgreSQL database dump complete
--
ALTER SEQUENCE public.resolve_activity_sequence_seq RESTART WITH 477;
COMMIT;
