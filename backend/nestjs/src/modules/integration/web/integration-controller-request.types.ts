export type IntegrationUserRequest = {
  user: {
    userId: string;
  };
};

export type IntegrationCompanyScopedRequest = {
  user: {
    scope: {
      companyIds: string[];
    };
  };
};

export type IntegrationUserCompanyScopedRequest = {
  user: {
    userId: string;
    scope: {
      companyIds: string[];
    };
  };
};
