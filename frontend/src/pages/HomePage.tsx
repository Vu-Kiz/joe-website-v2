import React, { useState } from "react";
import JenTicker from "../components/jen/JenTicker";
import EotmPanel from "../components/home/EotmPanel";
import WeatherPanel from "../components/home/WatherPanel";
import TenetsOfSalvagePanel from "../components/home/TenetsOfSalvagePanel";
import styles from "../styles/home.module.sass";
import jawaLogo from "../assets/branding/jawalogo.png";
import vertBanner from "../assets/home/VertBanner.png";
import jawaMap from "../assets/home/JawaMap.gif";
import contactBanner from "../assets/home/DiplomacyBanner.png";

type TabKey = "overview" | "territories";

const HomePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const showOverview = activeTab === "overview";
  const showTerritories = activeTab === "territories";

  return (
    <>
      <JenTicker />

      <div className="app app--three faction-page">
        {/* MAIN (50%) */}
        <main className="board main-col">
          <div className={styles.headerRow}>
            <img src={jawaLogo} alt="JOE" className={styles.logo} />
            <h1 className={styles.title}>Jawa Offworld Enterprises</h1>
          </div>

          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tab} ${showOverview ? styles.tabActive : styles.tabInactive}`}
              onClick={() => setActiveTab("overview")}
            >
              JOE Overview
            </button>
            <button
              type="button"
              className={`${styles.tab} ${showTerritories ? styles.tabActive : styles.tabInactive}`}
              onClick={() => setActiveTab("territories")}
            >
              Jawa Territories
            </button>
          </div>

          <div className={styles.views}>
            {showOverview && (
              <div className={styles.overviewLayout}>
                <div className="panel-banner is-vert">
                  <img src={vertBanner} alt="JOE Overview Banner" />
                </div>

                <div className={styles.small}>
                  <p>
                    Founded by prominent Jawas Jic Uiji, Kolomon Seph, and Ini Kedi in YR 19, Jawa
                    Offworld Enterprises is a megacorporation turned regional government which
                    primarily profits through the investment in and creation of Jawa and
                    Jawa-adjacent business ventures. Initially the conglomerate of clans quickly
                    rose to prominence in the galaxy, being at the center of a number of galactic
                    events and achievements. This has been largely attributed by the group to the
                    natural skill at conducting business possessed by the Jawa people. Ironically,
                    the group of "Offworld" Jawas has had considerable activity focused on their
                    homeworld of Tatooine, after assuming control of the planet in mid YR 21. Since
                    that point, peaceful relations between Jawas and Tusken tribes have thrived and
                    prospered and even human moisture farmer burnings have substantially decreased
                    in per capita reportings.
                  </p>

                  <p>
                    Originally only allowing Jawas to hold seats of prominence within the
                    organization, JOE leadership eventually made the decision to allow non-Jawas to
                    also share limited rights within the prestigious Jawa Council of clan
                    representatives. This led to the eventual business merger of the formerly
                    transient Veilhal Nomad group, later rebranding to Jawa Outer Colonies and
                    overseeing all operations and ventures in the once-JOE-controlled Xappyh Sector
                    to the far north alongside Regional Governor Bli Tokla of JOE. The once pirate
                    organization known as Requiem, led by charlatan and corsair Redjon Mirrabel,
                    was also later indoctrinated into the JOE ranks and heavily contributing to the
                    groups combat and espionage efficiency in tackling rogue business dealings and
                    unpaid debts. With them they brought various substantial land holdings in the
                    galactic Core which allowed JOE to once again exert its influence and expand
                    its reach throughout the galaxy.
                  </p>

                  <p>
                    Jawa Offworld Enterprises has since used a variety of business tactics and
                    acumen both overt and otherwise to grow into the role of being the de facto
                    government of multiple sectors, four galactic systems, one hundred planetary
                    bodies, and holding political sway over four races of sentient beings.
                  </p>
                </div>
              </div>
            )}

            {showTerritories && (
              <>
                <div className={styles.mapContainer}>
                  <img src={jawaMap} alt="Jawa Territories Map" className={styles.map} />
                </div>
                <h3>Tatoo</h3>
                <p className={styles.small}>
                  Tatoo is the central hub of activity for the greater Jawa Territories and the
                  Arkanis sector. Virtually all trade, both legal and illicit, either passes
                  through the Tatoo system or ends its run there. Jawas, Tusken Raiders and a
                  multitude of other sentients call the system home, specifically the central
                  planet of Tatooine. The sprawling city of Mos Espa on Tatooine is the seat of
                  JOE&apos;s power throughout the Outer Rim and beyond, and also the pinnacle of
                  galactic trade hosting a large, well-attended annual Swap Meet.
                </p>
                <h3>Geonosis</h3>
                <p className={styles.small}>
                  The Geonosis system, home to the laborious Geonosian builders, is where the
                  majority of manufacturing happens within the JOE borders. Under Jawa-led labor
                  unions, the Geonosians keep the Jawa machinery turning at a prodigious rate –
                  and workplace safety for humans isn&apos;t a concern as humans aren&apos;t allowed
                  work permits in the system.
                </p>
                <h3>Pii</h3>
                <p className={styles.small}>
                  The large coaxial asteroid rings and five volcanic planets of the Pii system
                  serve as ripe mineral resource troves for Jawa industry, supporting a myriad of
                  production and manufacturing endeavors for both JOE and Twin Suns Trading. Many
                  independent governing bodies hold control of asteroid-based city structures but
                  commerce flows invariably back, directly or indirectly, to Jawa Offworld
                  Enterprises and its limited regulations.
                </p>
                <h3>Arvala</h3>
                <p className={styles.small}>
                  Located in the Hunnovers sector, the Arvala system was initially contested by
                  multiple powers. Through thorough militaristic and infrastructure operations
                  conducted by Jawa surveyors, operators and garrison forces, followed by
                  diplomatic arrangements, JOE took stewardship of the system and multiple worlds
                  within. Now the site of joint military operations keeping the heavily trafficked
                  Arvala-7 safe zone free from pirate activities, peace is maintained by a mix of
                  commerce and Jawa “encouragement”.
                </p>
                <h3>Outer Habitation Belt</h3>
                <p className={styles.small}>
                  The vast flowing asteroid fields of the greater Arkanis, Hunnovers, Savareen,
                  Dalchon, Grohl and Trans-nebular sectors. These fields and the habitable
                  planetoids within them are claimed sovereign territories of Jawa Offworld
                  Enterprises and affiliated organizations. Heavily patrolled, highly militarized,
                  and notoriously deadly; many pockets of the belt are home to pirate and
                  spacefaring cartel groups. Through various means both diplomatic and aggressive
                  many of the operators within these areas have pledged loyalty to JOE. Those that
                  don’t are obliterated or have their technology repossessed by Jawa operatives.
                </p>
              </>
            )}
          </div>
        </main>

        {/* SIDE COL 1 (25%) */}
        <aside className="side-col">
          <WeatherPanel />
          <EotmPanel />
        </aside>

        {/* SIDE COL 2 (25%) */}
        <aside className="side-col">
          <section className="panel centered">
            <div className="panel-banner">
              <img src={contactBanner} alt="Contact JOE" />
            </div>

            <div className={styles.small}>
              <p>
                To join JOE, request diplomatic talks, or resolve contractual matters, please
                contact Grand Commodore Kolo Seph through official channels.
              </p>
            </div>

            <a
              href="https://www.swcombine.com/members/messages/"
              className="btn contact-btn"
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginTop: 10, display: "inline-block" }}
            >
              Contact Grand Commodore Kolo Seph
            </a>
          </section>

          <TenetsOfSalvagePanel />
        </aside>
      </div>
    </>
  );
};

export default HomePage;