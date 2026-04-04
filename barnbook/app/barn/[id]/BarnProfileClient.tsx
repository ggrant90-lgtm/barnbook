"use client";

import { HorsePhoto } from "@/components/HorsePhoto";
import type { Barn, BarnPhoto, Horse } from "@/lib/types";
import Link from "next/link";
import { useState } from "react";

function SocialIcon({ type }: { type: "instagram" | "facebook" | "website" }) {
  if (type === "instagram") {
    return (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    );
  }
  if (type === "facebook") {
    return (
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385h-3.047v-3.47h3.047v-2.642c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953h-1.514c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385c5.738-.9 10.126-5.864 10.126-11.854z" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

export function BarnProfileClient({
  barn,
  photos,
  horses,
}: {
  barn: Barn;
  photos: BarnPhoto[];
  horses: Pick<Horse, "id" | "name" | "breed" | "photo_url">[];
}) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const location = [barn.city, barn.state].filter(Boolean).join(", ");
  const fullAddress = [barn.address, barn.city, barn.state, barn.zip].filter(Boolean).join(", ");

  const hasSocial = barn.website || barn.instagram || barn.facebook;
  const hasContact = barn.public_email || barn.public_phone || fullAddress;

  return (
    <div className="min-h-screen bg-parchment">
      {/* ─── Hero Banner ─── */}
      <div className="relative h-48 bg-barn-dark sm:h-64 md:h-80">
        {barn.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={barn.banner_url}
            alt=""
            className="h-full w-full object-cover opacity-80"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-barn-dark via-barn-panel to-barn-dark" />
        )}
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-barn-dark/80 to-transparent" />
      </div>

      {/* ─── Barn Identity ─── */}
      <div className="relative mx-auto max-w-4xl px-4 sm:px-6">
        <div className="-mt-16 flex items-end gap-4 sm:-mt-20">
          {barn.logo_url ? (
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-parchment bg-white shadow-lg sm:h-32 sm:w-32">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={barn.logo_url} alt={barn.name} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border-4 border-parchment bg-barn-dark shadow-lg sm:h-32 sm:w-32">
              <span className="font-serif text-3xl font-semibold text-brass-gold sm:text-4xl">
                {barn.name.charAt(0)}
              </span>
            </div>
          )}
          <div className="pb-1">
            <h1 className="font-serif text-2xl font-semibold text-barn-dark sm:text-3xl">
              {barn.name}
            </h1>
            {location ? (
              <p className="text-sm text-barn-dark/55">{location}</p>
            ) : null}
          </div>
        </div>

        {/* ─── About ─── */}
        {barn.about ? (
          <section className="mt-8">
            <h2 className="font-serif text-lg text-barn-dark">About</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-barn-dark/75">
              {barn.about}
            </p>
          </section>
        ) : null}

        {/* ─── Contact & Social ─── */}
        {hasContact || hasSocial ? (
          <section className="mt-8 rounded-2xl border border-barn-dark/10 bg-white p-5 shadow-sm">
            <h2 className="font-serif text-lg text-barn-dark">Contact</h2>
            <div className="mt-3 space-y-2">
              {barn.public_phone ? (
                <p className="flex items-center gap-2 text-sm text-barn-dark/70">
                  <svg className="h-4 w-4 text-brass-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {barn.public_phone}
                </p>
              ) : null}
              {barn.public_email ? (
                <p className="flex items-center gap-2 text-sm text-barn-dark/70">
                  <svg className="h-4 w-4 text-brass-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {barn.public_email}
                </p>
              ) : null}
              {fullAddress ? (
                <p className="flex items-center gap-2 text-sm text-barn-dark/70">
                  <svg className="h-4 w-4 text-brass-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {fullAddress}
                </p>
              ) : null}
            </div>
            {hasSocial ? (
              <div className="mt-4 flex gap-3">
                {barn.website ? (
                  <a
                    href={barn.website.startsWith("http") ? barn.website : `https://${barn.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-brass-gold hover:underline"
                  >
                    <SocialIcon type="website" />
                    Website
                  </a>
                ) : null}
                {barn.instagram ? (
                  <a
                    href={`https://instagram.com/${barn.instagram.replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-brass-gold hover:underline"
                  >
                    <SocialIcon type="instagram" />
                    Instagram
                  </a>
                ) : null}
                {barn.facebook ? (
                  <a
                    href={barn.facebook.startsWith("http") ? barn.facebook : `https://facebook.com/${barn.facebook}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-brass-gold hover:underline"
                  >
                    <SocialIcon type="facebook" />
                    Facebook
                  </a>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {/* ─── Photo Gallery ─── */}
        {photos.length > 0 ? (
          <section className="mt-8">
            <h2 className="font-serif text-lg text-barn-dark">Photos</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setLightboxIdx(i)}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-barn-dark/10"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.photo_url}
                    alt={p.caption ?? ""}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                  {p.caption ? (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                      <p className="text-xs text-white">{p.caption}</p>
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* ─── Lightbox ─── */}
        {lightboxIdx !== null ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setLightboxIdx(null)}
          >
            <button
              type="button"
              onClick={() => setLightboxIdx(null)}
              className="absolute right-4 top-4 text-white/70 hover:text-white"
            >
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {lightboxIdx > 0 ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
              >
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : null}
            {lightboxIdx < photos.length - 1 ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
              >
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[lightboxIdx].photo_url}
              alt={photos[lightboxIdx].caption ?? ""}
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            {photos[lightboxIdx].caption ? (
              <p className="absolute bottom-6 text-center text-sm text-white/80">
                {photos[lightboxIdx].caption}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* ─── Horse Roster ─── */}
        {horses.length > 0 ? (
          <section className="mt-8">
            <h2 className="font-serif text-lg text-barn-dark">Our Horses</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {horses.map((h) => (
                <Link
                  key={h.id}
                  href={`/care/${h.id}`}
                  className="group overflow-hidden rounded-2xl border border-barn-dark/10 bg-white shadow-sm transition-all hover:border-brass-gold/40 hover:shadow-md"
                >
                  <div className="aspect-[4/3] overflow-hidden">
                    <HorsePhoto
                      name={h.name}
                      photoUrl={h.photo_url}
                      aspectClassName="aspect-[4/3] w-full"
                      className="transition-transform group-hover:scale-105"
                    />
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-barn-dark">{h.name}</p>
                    {h.breed ? (
                      <p className="text-xs text-barn-dark/50">{h.breed}</p>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* ─── Footer ─── */}
        <footer className="mt-12 pb-8 text-center">
          <p className="text-xs text-barn-dark/40">
            Powered by{" "}
            <Link href="/" className="text-brass-gold hover:underline">
              BarnBook
            </Link>{" "}
            — Every horse. Every detail. One book.
          </p>
        </footer>
      </div>
    </div>
  );
}
