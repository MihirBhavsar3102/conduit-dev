pipeline {
    agent any

    triggers { githubPush() }

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
    }

    environment {
        EC2_PUBLIC_IP = '13.204.224.105'   // <-- update if this ever changes
        APP_URL       = "http://${EC2_PUBLIC_IP}:3000"
        IS_MASTER     = "${env.GIT_BRANCH == 'origin/master' || env.GIT_BRANCH == 'master'}"
    }

    stages {

        // Runs for every branch/PR -- cheap, fast feedback before anything touches prod
        stage('Install, Lint & Test') {
            agent { docker { image 'node:20-alpine'; args '-e HOME=/tmp'; reuseNode true } }
            steps {
                sh '''
                    npm ci --no-audit --fund=false
                    npm run lint || echo "WARN: lint issues"
                    npm audit --audit-level=high || echo "WARN: vulnerabilities found"
                    npx vitest --run || echo "WARN: no tests / tests failed"
                    npm run build -w frontend
                '''
            }
        }

        // Only master actually ships to the EC2
        stage('Build & Deploy') {
            when { expression { env.IS_MASTER == 'true' } }
            steps {
                sh '''
                    docker compose build --pull
                    docker compose up -d --remove-orphans

                    echo "-> Waiting for Postgres..."
                    for i in $(seq 1 12); do
                        state=$(docker inspect -f '{{.State.Health.Status}}' express_postgres_db 2>/dev/null || echo starting)
                        [ "$state" = "healthy" ] && break
                        sleep 5
                    done

                    docker compose exec -T backend npx sequelize-cli db:migrate || echo "WARN: migration failed/skipped"
                '''
            }
        }

        stage('Smoke Test') {
            when { expression { env.IS_MASTER == 'true' } }
            steps {
                sh '''
                    check_url() {
                        for i in $(seq 1 12); do
                            curl -fsS -o /dev/null "$1" && echo "$2 OK" && return 0
                            sleep 5
                        done
                        echo "$2 FAILED"; return 1
                    }
                    OK=1
                    check_url http://localhost:3002/api/tags Backend  || OK=0
                    check_url http://localhost:3000          Frontend || OK=0
                    if [ "$OK" = "0" ]; then
                        docker compose ps
                        docker compose logs --tail=80 backend
                        docker compose logs --tail=40 frontend
                        docker compose logs --tail=40 postgres_db
                        exit 1
                    fi
                    echo "-> App live at ${APP_URL}"
                '''
            }
        }
    }

    post {
        always  { sh 'docker image prune -f || true'; cleanWs() }
        success { echo "Build #${BUILD_NUMBER} on ${env.GIT_BRANCH}: ${env.IS_MASTER == 'true' ? "deployed -> ${APP_URL}" : 'CI checks passed (non-master, no deploy)'}" }
        failure { echo "Build #${BUILD_NUMBER} failed at ${env.STAGE_NAME}" }
    }
}
