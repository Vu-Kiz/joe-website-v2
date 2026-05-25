import React, { useState } from "react";
import JenTicker from "../components/jen/JenTicker";
import EotmPanel from "../components/home/EotmPanel";
import WeatherPanel from "../components/home/WatherPanel";
import TenetsOfSalvagePanel from "../components/home/TenetsOfSalvagePanel";
import ContactRequestOverlay from "../components/home/ContactRequestOverlay";
import jawaLogo from "../assets/branding/jawalogo.png";
import vertBanner from "../assets/home/VertBanner.png";
import jawaMap from "../assets/home/JawaMap.gif";
import contactBanner from "../assets/home/DiplomacyBanner.png";
import { BTN } from "../utils/ui";

const HEADER_ROW_CLS = "flex items-center gap-3 mb-3";
const LOGO_CLS = "w-16 h-16 rounded-full border-2 border-[var(--accent)] object-cover";
const TABS_CLS = "flex gap-2 border-b border-[rgba(245,213,70,0.35)] mb-3";
const TAB_BASE = "px-[0.9rem] py-[0.35rem] border-0 bg-transparent text-[0.85rem] tracking-[0.08em] uppercase cursor-pointer border-b-2 transition-[color,border-color] duration-150 ease font-['Tektur',sans-serif]";
const tabCls = (active: boolean) =>
  TAB_BASE + (active
    ? " text-[var(--accent)] border-b-[var(--accent)]"
    : " text-white/70 border-b-transparent hover:text-[var(--accent)] hover:border-b-[rgba(245,213,70,0.4)]");
const OVERVIEW_LAYOUT_CLS = "grid [grid-template-columns:120px_minmax(0,1fr)] max-[600px]:[grid-template-columns:1fr] gap-4 items-stretch";

type TabKey = "overview" | "territories";

const HomePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [contactOverlay, setContactOverlay] = useState<"contact" | "diplomacy" | null>(null);
  const showOverview = activeTab === "overview";
  const showTerritories = activeTab === "territories";

  return (
    <>
      <JenTicker />

      {contactOverlay && (
        <ContactRequestOverlay
          requestType={contactOverlay}
          onClose={() => setContactOverlay(null)}
        />
      )}

      <div className="app app--three faction-page">
        {/* MAIN (50%) */}
        <main className="board main-col">
          <div className={HEADER_ROW_CLS}>
            <img src={jawaLogo} alt="JOE" className={LOGO_CLS} />
          </div>

          <div className={TABS_CLS}>
            <button
              type="button"
              className={tabCls(showOverview)}
              onClick={() => setActiveTab("overview")}
            >
              JOE Overview
            </button>
            <button
              type="button"
              className={tabCls(showTerritories)}
              onClick={() => setActiveTab("territories")}
            >
              Jawa Territories
            </button>
          </div>

          <div className="mt-3">
            {showOverview && (
              <div className={OVERVIEW_LAYOUT_CLS}>
                <div className="panel-banner is-vert">
                  <img src={vertBanner} alt="JOE Overview Banner" />
                </div>

                <div>
                  <p className="copy">
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

                  <p className="copy">
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

                  <p className="copy">
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
                <div className="w-full flex justify-center my-3">
                  <img src={jawaMap} alt="Jawa Territories Map" className="w-full h-auto max-w-[650px] rounded-[12px]" />
                </div>
                <h3 className="h3">Tatoo</h3>
                <p className="small">
                  Tatoo is the central hub of activity for the greater Jawa Territories and the Arkanis sector. Virtually all trade, both legal and illicit, either passes through the Tatoo system or ends its run there. Jawas, Tusken Raiders and a multitude of other sentients call the system home, specifically the central planet of Tatooine. The sprawling city of Mos Espa on Tatooine is the seat of all JOE business dealings throughout the Outer Rim and beyond, and also the pinnacle of galactic trade hosting the largest attended annual Swap Meet in the known systems. All forms of trade are recognized on Tatooine and Jawa businesses pride themselves on their dealings with any and all organizations, governments and sectors of the galaxy. The moon of Chenini is the center of research, development and production for the galaxy-renowned Sarlacc Integrated Design corporation which provides arms, armament and armor throughout the settled systems.
                </p>
                <h3 className="h3">Geonosis</h3>
                <p className="small">
                  The Geonosis system, home to the laborious Geonosian bugpeople and Jawa industry, is where the majority of manufacturing happens within the JOE borders. Under Jawa-led labor unions, the Geonosians keep the Jawa war machine chugging at an unchallenged cadence. Human resources issues are not a concern as humans aren't allowed work permits in the system.
                </p>
                <h3 className="h3">Pii</h3>
                <p className="small">
                  The large coaxial asteroid rings and five volcanic planets of the Pii system serve as ripe mineral resource troves for Jawa industry, supporting a myriad of production and manufacturing endeavors in the area for both JOE and Twin Suns Trading. Many independent governing bodies hold control of asteroid-based city structures throughout the system, reporting directly to Jawa Offworld Enterprises and its limited regulations.
                </p>
                <h3 className="h3">Arvala</h3>
                <p className="small">
                  Located in the Hunnovers sector, the Arvala system when discovered was initially contested by Jawa Offworld Enterpises, Corliss & Co. and various subgroups of the Alliance to Restore the Republic. Through thorough militaristic and infrastructure operations conducted by JOE surveyors, operators and ground troops who were among the first to arrive in the newly found system, and later diplomatic treatises between all groups present, JOE took and retained control of the system and multiple planets within. Now the site of joint military operations keeping the heavily trafficked Arvala-7 safe zone free from pirate activities, peace is kept between all prominent resident governments and business interests in the outlying system.
                </p>
                <h3 className="h3">Outer Habitation Belt</h3>
                <p className="small">
                  The vast flowing asteroid fields of the greater Arkanis, Hunnovers, Savareen, Dalchon, Grohl and Trans-nebular sectors. These fields and the habitable planetoids within them are claimed sovereign territories of Jawa Offworld Enterprises and affiliated organizations. Heavily patrolled, highly militarized, and notoriously deadly; many pockets of the belt are home to pirate and spacefaring cartel groups. Through various means both diplomatic and aggressive many of the operators within these areas have pledged loyalty to JOE. Those that don't are obliterated or have their technology repossessed by Jawa operatives.
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

            <p className="copy">
              To join JOE, request diplomatic talks, or resolve contractual matters, please
              contact Grand Commodore Kolo Seph through official channels.
            </p>

            <div className="flex flex-wrap gap-3 justify-center">
              <button
                type="button"
                className={BTN + " contact-btn"}
                style={{ marginTop: 10 }}
                onClick={() => setContactOverlay("contact")}
              >
                Contact Grand Commodore Kolo Seph
              </button>
            </div>
          </section>

          <TenetsOfSalvagePanel />
        </aside>
      </div>
    </>
  );
};

export default HomePage;
