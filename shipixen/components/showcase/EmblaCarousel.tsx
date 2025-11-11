import React, { useEffect, useRef, useState, useCallback } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { EmblaOptionsType, EmblaCarouselType } from 'embla-carousel';
import Link from 'next/link';
import { CoreContent } from '@shipixen/pliny/utils/contentlayer';
import { Blog } from 'shipixen-contentlayer/generated';
import Image from 'next/image';
import { Button } from '@/components/shared/ui/button';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useAutoplayProgress } from '@/components/showcase/EmblaCarouselAutoplayProgress';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import { hashStringToColor } from '@/components/shared/util/hash-string-color';
import { cn } from '@/lib/utils';

type UsePrevNextButtonsType = {
  prevBtnDisabled: boolean;
  nextBtnDisabled: boolean;
  onPrevButtonClick: () => void;
  onNextButtonClick: () => void;
};

const fallbackImage = '/static/images/logo.png';

export const usePrevNextButtons = (
  emblaApi: EmblaCarouselType | undefined,
  onButtonClick?: (emblaApi: EmblaCarouselType) => void,
): UsePrevNextButtonsType => {
  const [prevBtnDisabled, setPrevBtnDisabled] = useState(true);
  const [nextBtnDisabled, setNextBtnDisabled] = useState(true);

  const onPrevButtonClick = useCallback(() => {
    if (!emblaApi) return;
    emblaApi.scrollPrev();
    if (onButtonClick) onButtonClick(emblaApi);
  }, [emblaApi, onButtonClick]);

  const onNextButtonClick = useCallback(() => {
    if (!emblaApi) return;
    emblaApi.scrollNext();
    if (onButtonClick) onButtonClick(emblaApi);
  }, [emblaApi, onButtonClick]);

  const onSelect = useCallback((emblaApi: EmblaCarouselType) => {
    setPrevBtnDisabled(!emblaApi.canScrollPrev());
    setNextBtnDisabled(!emblaApi.canScrollNext());
  }, []);

  useEffect(() => {
    if (!emblaApi) return;

    onSelect(emblaApi);
    emblaApi.on('reInit', onSelect).on('select', onSelect);
  }, [emblaApi, onSelect]);

  return {
    prevBtnDisabled,
    nextBtnDisabled,
    onPrevButtonClick,
    onNextButtonClick,
  };
};

type PropType = {
  apps: CoreContent<Blog>[];
  options?: EmblaOptionsType;
  autoplayOnHover?: boolean;
};

const EmblaCarousel: React.FC<PropType> = ({
  apps,
  options,
  autoplayOnHover = false,
}) => {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: true, // Enable loop mode
      ...options,
    },
    [
      Autoplay({
        delay: 5000,
        stopOnInteraction: false,
        stopOnMouseEnter: autoplayOnHover,
      }),
    ],
  );

  const progressNode = useRef<HTMLDivElement>(null);

  const { showAutoplayProgress } = useAutoplayProgress(emblaApi, progressNode);

  const [currentIndex, setCurrentIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCurrentIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onSelect);
    onSelect();
  }, [emblaApi, onSelect]);

  // Restore navigation buttons functionality
  const {
    prevBtnDisabled,
    nextBtnDisabled,
    onPrevButtonClick,
    onNextButtonClick,
  } = usePrevNextButtons(emblaApi);

  // Calculate next app index with looping
  const nextIndex = (currentIndex + 1) % apps.length;
  const nextApp = apps[nextIndex];

  return (
    <div className="embla group relative flex flex-col w-full">
      <div className="overflow-hidden relative" ref={emblaRef}>
        <div className="embla__container">
          {apps.map((app, index) => {
            const tintColor = hashStringToColor(app.title);

            return (
              <div
                className={clsx(
                  'embla__slide w-full flex items-center justify-center transition-opacity duration-500 ease-in-out',
                  index === currentIndex
                    ? 'opacity-100 grayscale-0'
                    : 'opacity-50 grayscale',
                )}
                key={index}
              >
                <Link
                  href={`/products/${app.slug}`}
                  className="flex flex-col w-full"
                >
                  <Image
                    width={1600}
                    height={1600}
                    src={app.images?.[0]}
                    alt={app.title}
                    className="w-full h-auto rounded-xl max-h-[500px]"
                  />

                  <div className="flex flex-col items-center justify-center -mt-8">
                    <div className="flex gap-2 bg-white/90 dark:bg-black/90 backdrop-blur-xl rounded-xl py-2 px-3 items-center">
                      <figure
                        className={clsx(
                          'w-10 h-10 md:w-10 md:h-10 lg:w-14 lg:h-14 flex-shrink-0 rounded-2xl overflow-hidden bg-white/50 dark:bg-black/50',
                        )}
                      >
                        {app.logo ? (
                          <Image
                            src={app.logo}
                            alt="Product Thumbnail"
                            width={200}
                            height={200}
                            className="dark:bg-white/20"
                          />
                        ) : (
                          <div
                            className="w-full h-full"
                            style={{
                              backgroundImage: `url(${fallbackImage})`,
                              backgroundColor: tintColor,
                            }}
                          />
                        )}
                      </figure>
                      <h2 className="text-xl md:text-xl lg:text-2xl font-light">
                        {app.title}
                      </h2>
                    </div>

                    <ReactMarkdown
                      className={cn(
                        'text-sm mt-4 transition-opacity delay-500 ease-in duration-700 text-green-500',
                        currentIndex === index ? 'opacity-100' : 'opacity-0',
                      )}
                      disallowedElements={['a']}
                    >
                      {app.deal}
                    </ReactMarkdown>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="hidden md:flex absolute z-10 w-full h-full pointer-events-none items-center justify-between">
        <Button
          onClick={onPrevButtonClick}
          disabled={prevBtnDisabled}
          className="relative -left-10 pointer-events-auto opacity-0 group-hover:opacity-100 transition-all duration-500 ease-in-out hover:bg-transparent dark:hover:bg-transparent hover:scale-125"
          size="icon"
          variant="ghost"
        >
          <ChevronLeftIcon className="w-20 h-20 m-2" />
        </Button>
        <Button
          onClick={onNextButtonClick}
          disabled={nextBtnDisabled}
          className="relative -right-10 pointer-events-auto opacity-0 group-hover:opacity-100 transition-all duration-500 ease-in-out hover:bg-transparent dark:hover:bg-transparent hover:scale-125"
          size="icon"
          variant="ghost"
        >
          <ChevronRightIcon className="w-20 h-20 m-2" />
        </Button>
      </div>

      {/* Additional markup such as progress indicators */}
      <div className="absolute w-full -top-24 flex gap-2 items-center justify-end p-2">
        <div className="flex gap-1 items-end flex-col">
          <Button
            variant="ghost"
            onClick={onNextButtonClick}
            className={clsx(
              `embla__progress relative overflow-hidden flex items-center gap-2 pt-2 pb-4 px-3 h-14 md:min-w-32 bg-white dark:bg-black`,
            )}
          >
            <div className="border-gradient-rainbow absolute w-full bottom-0"></div>

            {nextApp.logo ? (
              <Image
                width={200}
                height={200}
                src={nextApp.logo as string}
                alt={nextApp.title}
                className="w-10 h-10 rounded-md"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-md"
                style={{
                  backgroundImage: `url(${fallbackImage})`,
                  backgroundColor: hashStringToColor(nextApp.title),
                }}
              />
            )}
            <span className="hidden md:flex">{nextApp.title}</span>

            <div
              className={clsx(
                'embla__progress__bar absolute top-0 left-0 w-full h-full backdrop-grayscale z-10',
                !showAutoplayProgress ? 'opacity-0' : 'opacity-100',
              )}
              ref={progressNode}
            />
          </Button>

          <p className="text-xs font-semibold uppercase opacity-50 mr-1 p-0.5">
            Up next
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmblaCarousel;
