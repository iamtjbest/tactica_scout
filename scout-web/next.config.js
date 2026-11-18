/** @type {import('next').NextConfig} */
const nextConfig = {
    async headers() {
        return [
            {
                source: "/.well-known/assetlinks.json",
                headers: [
                    {
                        key: "Content-Type",
                        value: "application/json",
                    },
                ],
            },
        ];
    },
};

module.exports = nextConfig;