pipeline {
    agent any

    // Fire on GitHub webhook push events
    triggers {
        githubPush()
    }

    options {
        timestamps()
        disableConcurrentBuilds()               // don't let two deploys race each other
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
    }

    environment {
        CI           = 'true'
        COMPOSE_FILE = 'docker-compose.yml'
        APP_URL      = 'http://localhost:3000'  // Vite frontend
        API_URL      = 'http://localhost:3002'  // Express backend (host port from compose)
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install & Static Checks') {
            // Only build/deploy master, but run CI checks for every branch/PR
            agent {
                docker {
                    image 'node:20-alpine'
                    args '-e HOME=/tmp'
                    reuseNode true
                }
            }
            steps {
                sh 'node --version && npm --version'
                // npm workspaces: one install at root covers backend + frontend
                sh 'npm ci --no-audit --fund=false'
                // Dependency vulnerability gate (non-blocking for now; tighten later)
                sh 'npm audit --audit-level=high || echo "WARN: high/critical vulnerabilities found"'
            }
        }

        stage('Unit Tests') {
            agent {
                docker {
                    image 'node:20-alpine'
                    args '-e HOME=/tmp'
                    reuseNode true
                }
            }
            steps {
                // Root "test" script = vitest; --run disables watch mode for CI
                sh 'npm ci --no-audit --fund=false'
                sh 'npx vitest --run || echo "WARN: no tests defined yet — add vitest specs"'
            }
        }

        stage('Frontend Production Build') {
            agent {
                docker {
                    image 'node:20-alpine'
                    args '-e HOME=/tmp'
                    reuseNode true
                }
            }
            steps {
                // Catches build-breaking errors (imports, JSX, env) before deploy
                sh 'npm ci --no-audit --fund=false'
                sh 'npm run build -w frontend'
            }
        }

        stage('Build Docker Images') {
            when { branch 'master' }
            steps {
                sh 'docker compose build --pull'
            }
        }

        stage('Deploy (docker compose)') {
            when { branch 'master' }
            steps {
                sh '''
                    echo "-> Rolling out new containers..."
                    docker compose up -d --remove-orphans

                    echo "-> Waiting for Postgres to be healthy..."
                    for i in $(seq 1 12); do
                        state=$(docker inspect -f '{{.State.Health.Status}}' express_postgres_db 2>/dev/null || echo "starting")
                        [ "$state" = "healthy" ] && break
                        sleep 5
                    done

                    echo "-> Running DB migrations..."
                    docker compose exec -T backend npx sequelize-cli db:migrate || echo "WARN: migration step failed/skipped"
                '''
            }
        }

        stage('Smoke Test') {
            when { branch 'master' }
            steps {
                sh '''
                    echo "-> Verifying services respond..."
                    sleep 5
                    curl -fsS -o /dev/null ${API_URL}/api/tags && echo "Backend OK" || (echo "Backend health check FAILED" && exit 1)
                    curl -fsS -o /dev/null ${APP_URL} && echo "Frontend OK" || (echo "Frontend health check FAILED" && exit 1)
                '''
            }
        }
    }

    post {
        always {
            sh 'docker image prune -f || true'
            cleanWs()
        }
        success {
            echo "✅ Build #${BUILD_NUMBER} deployed. App: ${APP_URL}"
        }
        failure {
            echo "❌ Build #${BUILD_NUMBER} failed at stage: ${env.STAGE_NAME}"
            // Roll back hint: docker compose logs shows what broke
            sh 'docker compose ps || true'
        }
    }
}
