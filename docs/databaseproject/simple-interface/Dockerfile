FROM mcr.microsoft.com/dotnet/sdk:8.0

WORKDIR /workspace

COPY package.json ./
COPY docs/databaseproject/simple-interface/PremadeGraph.DatabaseUi.csproj ./docs/databaseproject/simple-interface/

WORKDIR /workspace/docs/databaseproject/simple-interface
RUN dotnet restore

WORKDIR /workspace
COPY docs/databaseproject/simple-interface/Program.cs ./docs/databaseproject/simple-interface/
COPY docs/databaseproject/simple-interface/README.md ./docs/databaseproject/simple-interface/

WORKDIR /workspace/docs/databaseproject/simple-interface
RUN dotnet build -c Release --no-restore

ENV ASPNETCORE_URLS=http://0.0.0.0:5088
ENV DB_EXPLORER_PATH_BASE=/db-explorer

EXPOSE 5088

CMD ["dotnet", "run", "-c", "Release", "--no-build", "--urls", "http://0.0.0.0:5088"]
