const PRODUCT_RULE_FIELDS = `
  id
  title
  vendor
  productType
  status
  tags
  collections(first: 10) {
    nodes {
      handle
    }
  }
  variants(first: 100) {
    nodes {
      price
      compareAtPrice
      inventoryQuantity
    }
  }
`;

export const getProductById = async (admin, id) => {
  const response = await admin.graphql(
    `#graphql
      query productForTagRules($id: ID!) {
        product(id: $id) {
          ${PRODUCT_RULE_FIELDS}
        }
      }
    `,
    { variables: { id } },
  );

  const result = await response.json();
  return result.data?.product || null;
};

export const searchProducts = async (admin, query) => {
  const response = await admin.graphql(
    `#graphql
      query productsForPreview($query: String!) {
        products(first: 15, query: $query) {
          nodes {
            id
            title
            vendor
            tags
          }
        }
      }
    `,
    { variables: { query } },
  );

  const result = await response.json();
  return result.data?.products?.nodes || [];
};

export const listProductsPage = async (admin, cursor) => {
  const response = await admin.graphql(
    `#graphql
      query listProductsForBulk($after: String) {
        products(first: 100, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            ${PRODUCT_RULE_FIELDS}
          }
        }
      }
    `,
    { variables: { after: cursor || null } },
  );

  const result = await response.json();
  return {
    products: result.data?.products?.nodes || [],
    pageInfo: result.data?.products?.pageInfo || {
      hasNextPage: false,
      endCursor: null,
    },
  };
};

export const updateProductTags = async (admin, id, tags) => {
  const response = await admin.graphql(
    `#graphql
      mutation updateProductTags($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            tags
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        input: {
          id,
          tags,
        },
      },
    },
  );

  const result = await response.json();
  const userErrors = result.data?.productUpdate?.userErrors || [];

  if (userErrors.length) {
    throw new Error(userErrors.map((error) => error.message).join(", "));
  }

  return result.data?.productUpdate?.product || null;
};
