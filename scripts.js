        // Generate subtle star field
        function createStars() {
            const starsContainer = document.getElementById('stars');
            const numStars = 60;
            
            for (let i = 0; i < numStars; i++) {
                const star = document.createElement('div');
                star.className = 'star';
                star.style.left = Math.random() * 100 + '%';
                star.style.top = Math.random() * 100 + '%';
                star.style.animationDelay = Math.random() * 8 + 's';
                starsContainer.appendChild(star);
            }
        }

        // Smooth scrolling
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });

        // Fade in animation observer
        const observerOptions = {
            threshold: 0.15,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, observerOptions);

        document.querySelectorAll('.fade-in').forEach(el => {
            observer.observe(el);
        });

        // Initialize
        createStars();

        // Tab switching functionality
        function showResourceGroup(groupId) {
            // Hide all resource groups
            document.querySelectorAll('.resource-group').forEach(group => {
                group.classList.remove('active');
            });
            
            // Remove active state from all tab buttons
            document.querySelectorAll('.tab-button').forEach(button => {
                button.classList.remove('active');
            });
            
            // Show selected group
            document.getElementById(groupId).classList.add('active');
            
            // Add active state to clicked button
            event.target.classList.add('active');
        }

        // Make function globally available
        window.showResourceGroup = showResourceGroup;
		
		// Warranty Popup
        function openWarrantyPopup() {
            document.getElementById('warrantyPopup').style.display = 'block';
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }

        function closeWarrantyPopup(event) {
            // Close if clicking overlay or close button
            if (event && event.target !== document.getElementById('warrantyPopup')) {
                return;
            }
            
            document.getElementById('warrantyPopup').style.display = 'none';
            document.body.style.overflow = 'auto'; // Restore scrolling
        }

        // Close popup with Escape key
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                closeWarrantyPopup();
            }
        });