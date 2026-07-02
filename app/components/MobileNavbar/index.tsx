"use client";

import React from 'react';
import Link from 'next/link';

const MobileNavbar = () => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 shadow-md md:hidden border-borderMain/50 ring-borderMain/50 divide-borderMain/50 dark:divide-borderMainDark/50 dark:ring-borderMainDark/50 dark:border-borderMainDark/50 bg-offset dark:bg-offsetDark">
      <div className="relative h-mobileNavHeight border-t px-sm border-borderMain/50 ring-borderMain/50 divide-borderMain/50 dark:divide-borderMainDark/50 dark:ring-borderMainDark/50 dark:border-borderMainDark/50 bg-transparent">
        <div className="w-full">
          <div className="items-center relative flex-1 w-full">
            <div className="flex w-full">
              <div className="items-center relative flex-1 gap-x-md flex h-14 w-full">
                <div className="relative h-full flex items-center justify-center w-full border-borderMain/50 ring-borderMain/50 divide-borderMain/50 dark:divide-borderMainDark/50 dark:ring-borderMainDark/50 dark:border-borderMainDark/50 bg-transparent">
                  <div className="justify-center px-xs">
                    <Link href="/" className="!px-0 hover:!bg-transparent md:hover:bg-offsetPlus text-textOff dark:text-textOffDark md:hover:text-textMain dark:md:hover:bg-offsetPlusDark dark:md:hover:text-textMainDark py-md font-sans focus:outline-none outline-none outline-transparent transition duration-300 ease-in-out font-sans select-none items-center relative group/button justify-start rounded cursor-point active:scale-95 origin-center whitespace-nowrap flex w-full text-sm px-sm font-medium h-8" style={{WebkitTapHighlightColor: 'transparent'}}>
                      <div className="flex items-center min-w-0 justify-left w-full gap-xs">
                        {/* Home icon SVG here */}
                        <div className="text-align-center relative truncate leading-loose">Home</div>
                      </div>
                    </Link>
                  </div>
                </div>
                {/* Repeat for 'Discover' and 'Library' links */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileNavbar;