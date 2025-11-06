import 'css/prism.css';
import 'katex/dist/katex.css';
import Link from 'next/link';
import { Metadata } from 'next';

import PageTitle from '@/components/shared/PageTitle';
import { components } from '@/components/MDXComponents';
import { MDXLayoutRenderer } from '@shipixen/pliny/mdx-components';
import {
  sortPosts,
  coreContent,
  allCoreContent,
} from '@shipixen/pliny/utils/contentlayer';
import { allBlogs, allAuthors } from 'shipixen-contentlayer/generated';
import type { Authors, Blog } from 'shipixen-contentlayer/generated';
import { Button } from '@/components/shared/ui/button';
import Header from '@/components/shared/Header';
import PostSimple from '@/layouts/PostSimple';
import PostLayout from '@/layouts/PostLayout';
import PostBanner from '@/layouts/PostBanner';
import ProductLayout from '@/layouts/ProductLayout';

import { siteConfig } from '@/data/config/site.settings';

const BLOG_URL = siteConfig.blogPath ? `/${siteConfig.blogPath}` : '';

const defaultLayout = 'PostLayout';
const layouts = {
  PostSimple,
  PostLayout,
  PostBanner,
  ProductLayout,
};

export async function generateMetadata({
  params,
}: {
  params: { slug: string[] };
}): Promise<Metadata | undefined> {
  const path = BLOG_URL + decodeURI(params.slug.join('/'));
  const post = allBlogs.find((p) => p.path === path);
  const authorList = post?.authors || ['default'];
  const authorDetails = authorList.map((author) => {
    const authorResults = allAuthors.find((p) => p.slug === author);
    return coreContent(authorResults as Authors);
  });
  if (!post) {
    return;
  }

  const publishedAt = new Date(post.date).toISOString();
  const modifiedAt = new Date(post.lastmod || post.date).toISOString();
  const authors = authorDetails.map((author) => author.name);
  let imageList = [siteConfig.socialBanner];
  if (post.images) {
    imageList = typeof post.images === 'string' ? [post.images] : post.images;
  }
  const ogImages = imageList.map((img) => {
    return {
      url: img.includes('http') ? img : siteConfig.siteUrl + img,
    };
  });

  const seoTitle = `${post.title} | Rare Deals, Black Friday, Cyber Monday, Lifetime Deals, and more.`;

  const seoDescription = post.summary
    ? `${post.summary}. ${post.title} Rare Deals, Discounts, and Coupons.`
    : siteConfig.description;

  return {
    title: seoTitle,
    description: seoDescription,
    openGraph: {
      title: seoTitle,
      description: seoDescription,
      siteName: siteConfig.title,
      locale: 'en_US',
      type: 'article',
      publishedTime: publishedAt,
      modifiedTime: modifiedAt,
      url: './',
      images: ogImages,
      authors: authors.length > 0 ? authors : [siteConfig.author],
    },
    twitter: {
      card: 'summary_large_image',
      title: seoTitle,
      description: seoDescription,
      images: imageList,
    },
    ...(post.canonicalUrl
      ? {
          alternates: {
            canonical: post.canonicalUrl,
          },
        }
      : {}),
  };
}

export const generateStaticParams = async () => {
  const paths = allBlogs.map((p) => ({ slug: p.path.split('/') }));
  return paths;
};

export default async function Page({ params }: { params: { slug: string[] } }) {
  const path = decodeURI(params.slug.join('/'));
  // Filter out drafts in production
  const sortedCoreContents = allCoreContent(sortPosts(allBlogs));
  const postIndex = sortedCoreContents.findIndex((p) => p.path === path);
  if (postIndex === -1) {
    return (
      <div className="w-full flex flex-col items-center fancy-overlay">
        <Header />

        <div className="mt-24 text-center min-h-[40vh]">
          <PageTitle>
            Under Construction{' '}
            <span role="img" aria-label="roadwork sign">
              🚧
            </span>
          </PageTitle>

          <p className="mt-4">
            Oops, you've hit a page that doesn't seem to exist anymore.
          </p>

          <Button asChild className="mt-8">
            <Link href="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const prev = sortedCoreContents[postIndex + 1];
  const next = sortedCoreContents[postIndex - 1];
  const post = allBlogs.find((p) => p.path === path) as Blog;
  const authorList = post?.authors || ['default'];
  const authorDetails = authorList.map((author) => {
    const authorResults = allAuthors.find((p) => p.slug === author);
    return coreContent(authorResults as Authors);
  });
  const mainContent = coreContent(post);

  // Generate appropriate JSON-LD based on layout type
  let jsonLd: Record<string, unknown>;

  if (post.layout === 'ProductLayout') {
    // Generate Product schema for ProductLayout
    const productUrl = siteConfig.siteUrl + '/' + post.path;
    const imageUrl = post.images?.[0]
      ? post.images[0].includes('http')
        ? post.images[0]
        : siteConfig.siteUrl + post.images[0]
      : siteConfig.siteUrl + siteConfig.socialBanner;

    // Type-safe access to product-specific fields
    const productPost = post as Blog & {
      metaDescription?: string;
      logo?: string;
      website?: string;
      deal?: string;
      expiresOnDate?: string;
    };

    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: post.title.trim(),
      description: (
        productPost.metaDescription ||
        post.summary ||
        post.title
      ).trim(),
      image: imageUrl,
      url: productUrl,
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '5',
        bestRating: '5',
        ratingCount: '1',
      },
      ...(post.categories &&
        post.categories.length > 0 && {
          category: post.categories.join(', '),
        }),
      ...(productPost.logo && {
        brand: {
          '@type': 'Brand',
          name: post.title.trim(),
          logo: productPost.logo.includes('http')
            ? productPost.logo.trim()
            : siteConfig.siteUrl + productPost.logo.trim(),
        },
      }),
      ...(productPost.website && {
        offers: {
          '@type': 'Offer',
          url: productPost.website.trim(),
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          ...(productPost.deal && {
            description: productPost.deal.trim(),
          }),
          ...(productPost.expiresOnDate && {
            priceValidUntil: new Date(productPost.expiresOnDate).toISOString(),
          }),
        },
      }),
    };
  } else {
    // Use default Article schema for other layouts
    jsonLd = post.structuredData;
    jsonLd['author'] = authorDetails.map((author) => {
      return {
        '@type': 'Person',
        name: author.name,
      };
    });
  }

  const Layout = layouts[post.layout || defaultLayout];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Layout
        content={mainContent}
        authorDetails={authorDetails}
        next={next}
        prev={prev}
      >
        <MDXLayoutRenderer
          code={post.body.code}
          components={components}
          toc={post.toc}
        />
      </Layout>
    </>
  );
}
