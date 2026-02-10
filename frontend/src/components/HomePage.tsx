import React, { useState } from "react";

// Global styles for home layout / boards / panels
import "../styles/home.module.sass";


import jawaLogo from "../assets/branding/jawalogo.png";

import vertBanner from "../assets/home/VertBanner.png";
import jawaMap from "../assets/home/JawaMap.gif";
import weatherBanner from "../assets/home/WeatherBanner.png";
import employeeBanner from "../assets/home/EmployeeBanner.png";
import twinSuns from "../assets/home/twin-suns.png";
import contactBanner from "../assets/home/DiplomacyBanner.png";


// Navbar
import Navbar from "./Navbar";

type TabKey = "overview" | "territories";

const HomePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const showOverview = activeTab === "overview";
  const showTerritories = activeTab === "territories";

  return (
    <>
      {/* Global site navbar (V1-style) */}
      <Navbar />

      <div className="site-scale">
        <div className="app faction-page">
          {/* LEFT: Main board content (JOE overview + territories SPA) */}
          <main className="board">
            <header className="faction-header">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img
                  src={jawaLogo}
                  alt="Jawa Offworld Enterprises Logo"
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    border: "2px solid var(--accent)",
                    objectFit: "cover",
                  }}
                />
                <div>
                  <h1 className="faction-title">Jawa Offworld Enterprises</h1>
                </div>
              </div>
            </header>

            {/* Faction info + Jawa Territories tabbed panel */}
            <section className="section-block faction-panel">
              {/* Tabs */}
              <div className="panel-tabs">
                <button
                  type="button"
                  className={`panel-tab ${showOverview ? "active" : ""}`}
                  onClick={() => setActiveTab("overview")}
                >
                  JOE Overview
                </button>
                <button
                  type="button"
                  className={`panel-tab ${showTerritories ? "active" : ""}`}
                  onClick={() => setActiveTab("territories")}
                >
                  Jawa Territories
                </button>
              </div>

              {/* View 1: Faction info */}
              <div
                id="view-faction"
                className={`panel-view ${showOverview ? "is-active" : ""}`}
              >
                <div className="overview-layout">
                  {/* LEFT: Vertical banner */}
                  <div className="overview-banner">
                    <img
                      src={vertBanner}
                      alt="JOE Overview Banner"
                    />
                  </div>

                  {/* RIGHT: Lore text */}
                  <div className="small overview-text">
                    <p>
                      Founded by prominent Jawas Jic Uiji, Kolomon Seph, and
                      Ini Kedi in YR 19, Jawa Offworld Enterprises is a
                      megacorporation-turned regional government which primarily
                      profits through the investment in and creation of Jawa and
                      Jawa-adjacent business ventures. Initially the
                      conglomerate of clans quickly rose to prominence in the
                      galaxy, being at the center of a number of galactic
                      events and achievements. This has been largely attributed
                      by the group to the natural skill at conducting business
                      possessed by the Jawa people.
                    </p>

                    <p>
                      Ironically, the group of “Offworld” Jawas has had
                      considerable activity focused on their homeworld of
                      Tatooine, after assuming control of the planet in mid YR
                      21. Since that point, peaceful relations between Jawas and
                      Tusken tribes have thrived and prospered and even human
                      moisture farmer burnings have substantially decreased in
                      per capita reportings.
                    </p>

                    <p>
                      Originally only allowing Jawas to hold seats of prominence
                      within the organization, JOE leadership eventually made
                      the decision to allow non-Jawas to also share limited
                      rights within the prestigious Jawa Council of clan
                      representatives. This led to the eventual business merger
                      of the formerly transient Veilhal Nomad group, later
                      rebranding to Jawa Outer Colonies and overseeing all
                      operations and ventures in the once-JOE-controlled Xappyh
                      Sector to the far north alongside Regional Governor Bli
                      Tokla of JOE.
                    </p>

                    <p>
                      The once pirate organization known as Requiem, led by
                      charlatan and corsair Redjon Mirrabel, was also later
                      indoctrinated into the JOE ranks and heavily contributing
                      to the group&apos;s combat and espionage efficiency in
                      tackling rogue business dealings and unpaid debts. With
                      them they brought various substantial land holdings in the
                      galactic Core which allowed JOE to once again exert its
                      influence and expand its reach throughout the galaxy.
                    </p>

                    <p>
                      Jawa Offworld Enterprises has since used a variety of
                      business tactics and acumen both overt and otherwise to
                      grow into the role of being the de facto government of
                      multiple sectors, four galactic systems, one hundred
                      planetary bodies, and holding political sway over several
                      races of sentient beings.
                    </p>
                  </div>
                </div>
              </div>

              {/* View 2: Jawa Territories */}
              <div
                id="view-territories"
                className={`panel-view ${showTerritories ? "is-active" : ""}`}
              >
                <div className="jawa-map-container">
                  <img
                    src={jawaMap}
                    alt="Jawa Territories Map"
                    className="jawa-map"
                  />
                </div>

                <h3>Tatoo</h3>
                <p className="small">
                  Tatoo is the central hub of activity for the greater Jawa
                  Territories and the Arkanis sector. Virtually all trade, both
                  legal and illicit, either passes through the Tatoo system or
                  ends its run there. Jawas, Tusken Raiders and a multitude of
                  other sentients call the system home, specifically the central
                  planet of Tatooine. The sprawling city of Mos Espa on
                  Tatooine is the seat of JOE&apos;s power throughout the Outer
                  Rim and beyond, and also the pinnacle of galactic trade
                  hosting a large, well-attended annual Swap Meet.
                </p>

                <h3>Geonosis</h3>
                <p className="small">
                  The Geonosis system, home to the laborious Geonosian builders,
                  is where the majority of manufacturing happens within the JOE
                  borders. Under Jawa-led labor unions, the Geonosians keep the
                  Jawa machinery turning at a prodigious rate – and workplace
                  safety for humans isn&apos;t a concern as humans aren&apos;t
                  allowed work permits in the system.
                </p>

                <h3>Pii</h3>
                <p className="small">
                  The large coaxial asteroid rings and five volcanic planets of
                  the Pii system serve as ripe mineral resource troves for Jawa
                  industry, supporting a myriad of production and manufacturing
                  endeavors for both JOE and Twin Suns Trading. Many independent
                  governing bodies hold control of asteroid-based city
                  structures but commerce flows invariably back, directly or
                  indirectly, to Jawa Offworld Enterprises and its limited
                  regulations.
                </p>

                <h3>Arvala</h3>
                <p className="small">
                  Located in the Hunnovers sector, the Arvala system was
                  initially contested by multiple powers. Through thorough
                  militaristic and infrastructure operations conducted by Jawa
                  surveyors, operators and garrison forces, followed by
                  diplomatic arrangements, JOE took stewardship of the system
                  and multiple worlds within. Now the site of joint military
                  operations keeping the heavily trafficked Arvala-7 safe zone
                  free from pirate activities, peace is maintained by a mix of
                  commerce and Jawa “encouragement”.
                </p>
              </div>
            </section>
          </main>

          {/* RIGHT: Side panels – weather + Employee of the Month + contact */}
          <aside className="side-column">
            {/* Tatooine weather panel */}
            <section className="panel" id="tatooine-weather-panel">
              <div className="panel-banner">
                <img
                  src={weatherBanner}
                  alt="Mos Espa Weather Control"
                />
              </div>

              <img
                src={twinSuns}
                alt="Twin Suns"
                className="twin-suns-icon"
              />

              <p className="small" style={{ marginTop: 10 }}>
                Initialising Mos Espa Weather Control network…
              </p>
            </section>

            {/* Employee of the Month */}
            <section className="panel centered">
              <div className="panel-banner">
                <img
                  src={employeeBanner}
                  alt="Employee of the Month"
                />
              </div>

              <h2>Employee of the Month</h2>

              <div className="small">
                <p>
                  Our current Employee of the Month is being pulled from the
                  Jawa archives. This panel will be wired to the official JOE
                  records shortly.
                </p>
              </div>
            </section>

            {/* Contact JOE / Kolo Seph */}
            <section className="panel centered">
                <div className="panel-banner">
                <img
                  src={contactBanner}
                  alt="Contact JOE"
                />
              </div>

              <div className="small">
                <p>
                  To join JOE, request diplomatic talks, or resolve contractual
                  matters, please contact Grand Commodore Kolo Seph through
                  official channels.
                </p>
              </div>

              <div style={{ textAlign: "center", marginTop: 10 }}>
                <a
                  href="https://www.swcombine.com/members/messages/"
                  className="btn contact-btn"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Contact Grand Commodore Kolo Seph
                </a>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
};

export default HomePage;
