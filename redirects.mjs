const getRedirects = async () => {
  const internetExplorerRedirect = {
    source: '/:path((?!ie-incompatible.html$).*)',
    has: [
      {
        type: 'header',
        key: 'user-agent',
        value: '(.*Trident.*)',
      },
    ],
    permanent: false,
    destination: '/ie-incompatible.html',
  };

  try {
    const redirectsRes = await fetch(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/api/redirects?limit=1000&depth=1`,
    );

    if (!redirectsRes.ok) {
      throw new Error(`Redirects API responded with ${redirectsRes.status}`);
    }

    const contentType = redirectsRes.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(`Redirects API returned non-JSON content-type: ${contentType}`);
    }

    const redirectsData = await redirectsRes.json();
    const { docs } = redirectsData;

    let dynamicRedirects = [];

    if (docs) {
      docs.forEach(doc => {
        const { from, to: { type, url, reference } = {} } = doc

        let source = from
          .replace(process.env.NEXT_PUBLIC_SERVER_URL, '')
          .split('?')[0]
          .toLowerCase()

        if (source.endsWith('/')) source = source.slice(0, -1) // a trailing slash will break this redirect

        let destination = '/'

        if (type === 'custom' && url) {
          destination = url.replace(process.env.NEXT_PUBLIC_SERVER_URL, '')
        }

        if (
          type === 'reference' &&
          typeof reference.value === 'object' &&
          reference?.value?._status === 'published'
        ) {
          destination = `${process.env.NEXT_PUBLIC_SERVER_URL}/${
            reference.relationTo !== 'pages' ? `${reference.relationTo}/` : ''
          }${reference.value.slug}`
        }

        const redirect = {
          source,
          destination,
          permanent: true,
        }

        if (source.startsWith('/') && destination && source !== destination) {
          return dynamicRedirects.push(redirect)
        }

        return
      })
    }

    return [internetExplorerRedirect, ...dynamicRedirects];
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(`Dynamic redirects unavailable: ${error}`);
    }

    return [internetExplorerRedirect];
  }
};

export default getRedirects;
