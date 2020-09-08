Successfully created a simple image thumbnail generator using S3, Lambda and APIGateway (not needed)

- The Lambda function is doing 1500-2000ms with a 192MB memory function.
  - 1M free requests per month
  - 400,000 GB-seconds of compute time. ( ~0.384 GB-seconds per transform)
  - Based on pricing: Each GB-seconds costs $0.00002292, that means $1 USD should allow me to transform 115,000 photos.

