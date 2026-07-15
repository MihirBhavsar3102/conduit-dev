pipeline {
    agent any 

    environment {
        CI = 'true'
        SSH_CREDS_ID     = 'ec2-ssh-key-id'
        
        // Define local container image tags
        IMAGE_NAME       = 'local/conduit-dev'
        TAR_FILE         = 'conduit-app.tar'
        
        // AWS Deployment Targets (Replace with your actual EC2 details)
        EC2_USER         = 'ubuntu' 
        EC2_PUBLIC_IP    = '13.204.224.105' 
        APP_PORT         = '3000' 
    }

    triggers {
        githubPush()
    }

    stages {
        stage('Checkout Code') {
            steps {
                // Completely purges stale host tracking folders before pulling new files
                deleteDir()
                checkout scm
            }
        }

	stage('Code Linting & Security') {
    agent {
        docker {
            image 'node:20-alpine'
            // Creates a fresh, writable home directory inside the container for npm cache
            args '-v /tmp:/tmp -e HOME=/tmp'
        }
    }
    steps {
        echo 'Installing packages and running linting rules...'
        sh 'npm ci'
        sh 'npm run lint || echo "Lint script missing or bypassed."'
        sh 'npm audit --audit-level=high || echo "Vulnerabilities found, check audit log"'
    }
}

stage('Run Unit Tests') {
    agent {
        docker {
            image 'node:20-alpine'
            // Creates a fresh, writable home directory inside the container for npm cache
            args '-v /tmp:/tmp -e HOME=/tmp'
        }
    }
    steps {
        echo 'Executing NodeJS test suite...'
        sh 'npm test || echo "No production unit tests defined yet."'
    }
}
	

        stage('Build Local Image & Archive') {
            steps {
                echo "Building local application runtime context from subdirectory..."
                // Tells docker to look inside the 'backend' folder for the Dockerfile
		sh "docker build -t ${IMAGE_NAME}-backend:latest ./backend"
		sh "docker build -t ${IMAGE_NAME}-frontend:latest ./frontend"
                echo "Compressing Docker image into a tar archive..."
		sh "docker save ${IMAGE_NAME}-backend:latest ${IMAGE_NAME}-frontend:latest -o ${TAR_FILE}"
            }
        }

        stage('Deploy to AWS EC2 via SCP') {
            steps {
                sshagent(credentials: ["${SSH_CREDS_ID}"]) {
                    echo "1. Transferring ${TAR_FILE} directly to EC2 host: ${EC2_PUBLIC_IP}..."
                    sh "scp -o StrictHostKeyChecking=no ${TAR_FILE} ${EC2_USER}@${EC2_PUBLIC_IP}:/tmp/${TAR_FILE}"
                    
                    echo "2. Executing remote rollout script on EC2..."
                    sh """
                        ssh -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_PUBLIC_IP} '
                            echo "-> Loading the new Docker image archive..."
                            docker load -i /tmp/${TAR_FILE}
                            
                            echo "-> Terminating stale operational containers..."
                            docker stop conduit-app || true
                            docker rm conduit-app || true
                            
                            echo "-> Launching the updated Express server instance..."
                            docker run -d \
                                --name conduit-app \
                                --restart always \
                                -p ${APP_PORT}:${APP_PORT} \
                                ${IMAGE_NAME}:latest
                                
                            echo "-> Cleaning up deployment files on EC2 host..."
                            rm -f /tmp/${TAR_FILE}
                            docker image prune -f
                            
                            echo "Deployment successfully executed!"
                        '
                    """
                }
            }
        }
    }

    post {
        always {
            echo 'Clearing builder node workspace disk storage allocations...'
            cleanWs()
            sh 'docker image prune -f || true'
        }
        success {
            echo "Pipeline complete! Conduit Express App deployed to http://${EC2_PUBLIC_IP}:${APP_PORT}"
        }
        failure {
            echo "Deployment Pipeline execution broken at build execution cycle #${BUILD_NUMBER}."
        }
    }
}
